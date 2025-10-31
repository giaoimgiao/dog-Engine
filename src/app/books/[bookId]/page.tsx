'use client';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Book, Chapter, Character, WorldSetting } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Globe, Users, FileText, Menu, BookOpen, Network } from 'lucide-react';
import ChapterManager from '@/components/ChapterManager';
import PlotMindMap from '@/components/PlotMindMap';
import Editor from '@/components/Editor';
import WorldBookManager from '@/components/WorldBookManager';
import CharacterCardManager from '@/components/CharacterCardManager';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocalStorage as useLS } from '@/hooks/useLocalStorage';
import type { ThemePluginManifest } from '@/lib/theme-plugin';
import { THEME_PLUGINS_KEY, THEME_SELECTED_ID_KEY, applyThemeTokensToElement, getTokensForScope } from '@/lib/theme-plugin';

export default function BookPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params?.bookId as string;
  const isMobile = useIsMobile();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const [installedThemes] = useLS<ThemePluginManifest[]>(THEME_PLUGINS_KEY, []);
  const [selectedThemeId] = useLS<string | null>(THEME_SELECTED_ID_KEY, null);
  const sidebarScopeObserverRef = useRef<MutationObserver | null>(null);
  const sidebarScopeCleanupsRef = useRef<Array<() => void>>([]);

  const [books, setBooks] = useLocalStorage<Book[]>('books', []);
  // 关键修复：角色卡/世界书按书ID分桶存储，避免跨书互相污染
  const [worldSettings, setWorldSettings] = useLocalStorage<WorldSetting[]>(`worldSettings:${bookId}`, []);
  const [characters, setCharacters] = useLocalStorage<Character[]>(`characterCards:${bookId}`, []);
  
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isChapterSheetOpen, setIsChapterSheetOpen] = useState(false);
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [externalBooksForMindMap, setExternalBooksForMindMap] = useState<Book[]>([]);

  // Listen for external book updates from PlotSummaryManager
  useEffect(() => {
    const onUpdate = (e: any) => {
      const detail = e?.detail || {};
      // Support both full list update and incremental single-chapter update
      const extBookId = detail.bookId as string | undefined;
      if (!extBookId) return;
      if (detail.chapter) {
        const { chapter, title } = detail as any;
        setExternalBooksForMindMap(prev => {
          const idx = prev.findIndex(b => b.id === extBookId);
          if (idx >= 0) {
            const bookNow = prev[idx];
            const chIdx = bookNow.chapters.findIndex(c => c.id === chapter.id);
            const nextChapters = chIdx >= 0
              ? bookNow.chapters.map(c => c.id === chapter.id ? { ...c, title: chapter.title, summary: chapter.summary, content: '' } : c)
              : [...bookNow.chapters, { id: chapter.id, title: chapter.title, summary: chapter.summary, content: '' } as any];
            const next = prev.slice();
            next[idx] = { ...bookNow, title: title || bookNow.title, chapters: nextChapters } as any;
            return next;
          } else {
            return [...prev, { id: extBookId, title: title || '', description: '', chapters: [{ id: chapter.id, title: chapter.title, summary: chapter.summary, content: '' } as any] } as any];
          }
        });
        return;
      }
      if (Array.isArray(detail.chapters)) {
        const { title, chapters } = detail as any;
        setExternalBooksForMindMap(prev => {
          const existing = prev.find(b => b.id === extBookId);
          if (existing) {
            return prev.map(b => b.id === extBookId ? { ...b, title, chapters: chapters.map((ch: any) => ({ ...ch, content: '' })) } : b);
          } else {
            return [...prev, { id: extBookId, title, description: '', chapters: chapters.map((ch: any) => ({ ...ch, content: '' })) }];
          }
        });
      }
    };
    const onRemove = (e: any) => {
      const detail = e?.detail || {};
      const { bookId: extBookId } = detail;
      if (!extBookId) return;
      setExternalBooksForMindMap(prev => prev.filter(b => b.id !== extBookId));
    };
    const onClear = () => setExternalBooksForMindMap([]);
    window.addEventListener('mindmap:updateExternal', onUpdate as any);
    window.addEventListener('mindmap:removeExternal', onRemove as any);
    window.addEventListener('mindmap:clearExternal', onClear as any);
    return () => {
      window.removeEventListener('mindmap:updateExternal', onUpdate as any);
      window.removeEventListener('mindmap:removeExternal', onRemove as any);
      window.removeEventListener('mindmap:clearExternal', onClear as any);
    };
  }, []);

  // Lifted state for AI Assistant
  const DEFAULT_AI_ROLE = `你是一个擅长爽点设计与反转的网文作者，精于承接前文并自然引出下一章的冲突与悬念。请基于上文续写"下一章"的首稿，要求：
- 保持已有设定与角色性格一致
- 设计清晰的段落推进（起→承→转→合）
- 至少给出1个强悬念或爆点（以结尾埋钩）
- 语言保持网文节奏，短句为主，镜头感强`;
  const [aiRole, setAiRole] = useState(DEFAULT_AI_ROLE);
  const [aiRoleDisplay, setAiRoleDisplay] = useState('爽点设计与反转的网文作家');


  const currentBook = useMemo(() => {
    return books.find((b) => b.id === bookId);
  }, [books, bookId]);

  // Key for forcing PlotMindMap refresh. Must be declared before any early returns.
  const mindMapKey = useMemo(() => {
    if (!currentBook) return '';
    try {
      return currentBook.chapters.map(c => `${c.id}:${(c.summary || '').length}`).join('|');
    } catch {
      return '';
    }
  }, [currentBook]);

  // Apply scoped themes: topbar / sidebar / editor handled separately
  useEffect(() => {
    const manifest = installedThemes.find(t => t.id === selectedThemeId) || null;
    // topbar via query (Header has data-theme-scope="topbar")
    const headerEl = typeof window !== 'undefined' ? document.querySelector('header[data-theme-scope="topbar"]') as HTMLElement | null : null;
    const cleanupTop = headerEl ? applyThemeTokensToElement(headerEl, getTokensForScope(manifest, 'topbar')) : () => {};
    const cleanupSidebar = sidebarRef.current ? applyThemeTokensToElement(sidebarRef.current, getTokensForScope(manifest, 'sidebar')) : () => {};
    const cleanupMain = mainRef.current ? applyThemeTokensToElement(mainRef.current, getTokensForScope(manifest, 'root')) : () => {};

    // Apply sidebar scope to all dynamic containers (e.g., Sheet portals)
    const applySidebarScopeToAll = () => {
      sidebarScopeCleanupsRef.current.forEach(fn => fn());
      sidebarScopeCleanupsRef.current = [];
      const nodes = document.querySelectorAll('[data-theme-scope="sidebar"]');
      nodes.forEach(node => {
        const fn = applyThemeTokensToElement(node as HTMLElement, getTokensForScope(manifest, 'sidebar'));
        sidebarScopeCleanupsRef.current.push(fn);
      });
    };
    applySidebarScopeToAll();
    if (sidebarScopeObserverRef.current) sidebarScopeObserverRef.current.disconnect();
    sidebarScopeObserverRef.current = new MutationObserver(() => {
      applySidebarScopeToAll();
    });
    sidebarScopeObserverRef.current.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme-scope'] });

    return () => { 
      cleanupTop(); cleanupSidebar(); cleanupMain();
      sidebarScopeCleanupsRef.current.forEach(fn => fn());
      sidebarScopeCleanupsRef.current = [];
      if (sidebarScopeObserverRef.current) sidebarScopeObserverRef.current.disconnect();
    };
  }, [installedThemes, selectedThemeId]);
  
  useEffect(() => {
    if (currentBook) {
      // If there is no active chapter OR the active chapter is not in the current book's chapter list
      if (!activeChapterId || !currentBook.chapters.some(c => c.id === activeChapterId)) {
        // Set the first chapter as active, or null if there are no chapters
        setActiveChapterId(currentBook.chapters[0]?.id || null);
      }
    } else {
        // if the book is not found (e.g., deleted), clear the active chapter
        setActiveChapterId(null);
    }
  }, [currentBook, activeChapterId]);


  const activeChapter = useMemo(() => {
    if (!currentBook || !activeChapterId) return null;
    return currentBook.chapters.find(c => c.id === activeChapterId) || null;
  }, [currentBook, activeChapterId]);
  
  const setActiveChapter = (chapter: Chapter | null) => {
    setActiveChapterId(chapter ? chapter.id : null);
  };

  const updateChapterContent = (chapterId: string, content: string) => {
    const updatedBooks = books.map((book) => {
      if (book.id === bookId) {
        return {
          ...book,
          chapters: book.chapters.map((ch) =>
            ch.id === chapterId ? { ...ch, content } : ch
          ),
        };
      }
      return book;
    });
    setBooks(updatedBooks);
  };
  
  const updateBook = (updatedBook: Book) => {
    const updatedBooks = books.map(b => b.id === updatedBook.id ? updatedBook : b);
    setBooks(updatedBooks);
  }

  // This state helps prevent a flash of "Not Found" while data loads from localStorage
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
      // The hook now initializes with data, so we can set ready immediately.
      // A small delay might still be good for visual consistency on fast reloads.
      const timer = setTimeout(() => setIsReady(true), 50);
      return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-1/4 mb-4" />
        <div className="flex gap-8">
            <div className="w-1/4">
                <Skeleton className="h-96 w-full" />
            </div>
            <div className="w-3/4">
                <Skeleton className="h-full w-full" />
            </div>
        </div>
      </div>
    );
  }

  if (!currentBook) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
          <p className="text-2xl font-bold">书籍未找到</p>
          <Button onClick={() => router.push('/')} className="mt-4">返回书架</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header>
          <div className="flex items-center gap-2 mr-auto ml-2 sm:ml-4 min-w-0">
              {isMobile && (
                <Sheet open={isChapterSheetOpen} onOpenChange={setIsChapterSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-0 bg-card text-card-foreground" data-theme-scope="sidebar" style={{ background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderColor: 'hsl(var(--border))' }}>
                    <SheetHeader className="px-4 py-3 border-b">
                      <SheetTitle className='font-headline'>章节列表</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto p-2" style={{height: 'calc(100vh - 60px)'}}>
                      <ChapterManager 
                        book={currentBook}
                        updateBook={updateBook}
                        activeChapter={activeChapter}
                        setActiveChapter={(chapter) => {
                          setActiveChapter(chapter);
                          setIsChapterSheetOpen(false);
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <h1 className="text-base sm:text-xl font-bold font-headline truncate" title={currentBook.title}>{currentBook.title}</h1>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size={isMobile ? "icon" : "sm"}>
                <Globe className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                {!isMobile && "世界设定"}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[90vw] sm:w-[400px] md:w-[540px] flex flex-col bg-card text-card-foreground" side={isMobile ? "bottom" : "right"} data-theme-scope="sidebar" style={{ background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderColor: 'hsl(var(--border))' }}>
              <SheetHeader>
                <SheetTitle className='font-headline'>世界书</SheetTitle>
              </SheetHeader>
              <WorldBookManager worldSettings={worldSettings} setWorldSettings={setWorldSettings} currentBookId={bookId} />
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size={isMobile ? "icon" : "sm"}>
                <Users className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                {!isMobile && "角色卡"}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[90vw] sm:w-[400px] md:w-[540px] flex flex-col bg-card text-card-foreground" side={isMobile ? "bottom" : "right"} data-theme-scope="sidebar" style={{ background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderColor: 'hsl(var(--border))' }}>
              <SheetHeader>
                <SheetTitle className='font-headline'>角色卡片</SheetTitle>
              </SheetHeader>
              <CharacterCardManager 
                characters={characters} 
                setCharacters={setCharacters} 
                chapters={currentBook.chapters}
                currentBookId={bookId}
              />
            </SheetContent>
          </Sheet>
      </Header>
      <main ref={mainRef as any} className="flex-grow flex overflow-hidden">
        {!isMobile && (
          <div ref={sidebarRef as any} className="w-1/4 lg:w-1/5 border-r overflow-y-auto p-2" data-theme-scope="sidebar" style={{ background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderColor: 'hsl(var(--border))' }}>
            <ChapterManager 
              book={currentBook}
              updateBook={updateBook}
              activeChapter={activeChapter}
              setActiveChapter={setActiveChapter}
            />
          </div>
        )}
        <div className={isMobile ? "w-full flex flex-col overflow-hidden relative" : "w-3/4 lg:w-4/5 flex flex-col overflow-hidden relative"}>
          {activeChapter ? (
            <Editor 
              key={activeChapter.id}
              chapter={activeChapter} 
              updateChapterContent={updateChapterContent}
              fullContext={{ book: currentBook, characters, worldSettings }}
              aiRole={aiRole}
              setAiRole={setAiRole}
              aiRoleDisplay={aiRoleDisplay}
              setAiRoleDisplay={setAiRoleDisplay}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4 sm:p-8">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mb-4" />
              <h2 className="text-xl sm:text-2xl font-bold font-headline">没有选择章节</h2>
              <p className="mt-2 text-sm sm:text-base">请{isMobile ? "点击左上角菜单" : "在左侧"}选择一个章节进行编辑，或者创建一个新章节。</p>
            </div>
          )}

          {/* Floating MindMap button */}
          <Button
            variant="default"
            size="icon"
            className="absolute bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
            onClick={() => setIsMindMapOpen(true)}
            title="剧情脉络图"
          >
            <Network className="h-6 w-6" />
          </Button>
        </div>
      </main>

      {/* Plot MindMap Dialog */}
      <PlotMindMap 
        key={mindMapKey} 
        book={currentBook} 
        externalBooks={externalBooksForMindMap}
        open={isMindMapOpen} 
        onOpenChange={setIsMindMapOpen} 
      />
    </div>
  );
}
