'use client';

import { useState, useEffect, useRef } from 'react';
import type { Book, Chapter } from '@/lib/types';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAI } from '@/hooks/useAI';
import { FileText, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Slider } from './ui/slider';
import { AIProviderSettings } from './AIProviderSettings';
import ModelSelector from './ModelSelector';
import { useAIConfig } from '@/hooks/useAIConfig';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Users } from 'lucide-react';
import { getPrompts } from '@/lib/actions/community';
import type { CommunityPrompt } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

interface PlotSummaryManagerProps {
  book: Book;
  updateBook: (book: Book) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChapterSummaryState {
  chapterId: string;
  selected: boolean;
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress?: string;
}

export default function PlotSummaryManager({ book, updateBook, open, onOpenChange }: PlotSummaryManagerProps) {
  const { toast } = useToast();
  const { generateContentStream, canGenerate } = useAI();
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();
  
  const [chapterStates, setChapterStates] = useState<Map<string, ChapterSummaryState>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const [totalSelected, setTotalSelected] = useState(0);
  const cancelRequestedRef = useRef(false);
  const lastSyncTsRef = useRef(0);
  const bookRef = useRef(book);
  useEffect(() => { bookRef.current = book; }, [book]);

  // Source tabs: current book or bookstore
  const [activeSource, setActiveSource] = useState<'current' | 'store'>('current');
  const [storeSourceId, setStoreSourceId] = useState<string>('');
  const [storeBookUrl, setStoreBookUrl] = useState<string>('');
  const [storeLoading, setStoreLoading] = useState(false);
  const [externalBooks, setExternalBooks] = useState<Array<{ id: string; title: string; description?: string; chapters: Array<{ id: string; title: string; url: string; content?: string; summary?: string }> }>>([]);
  const [storeSearchKeyword, setStoreSearchKeyword] = useState('');
  const [storeSearching, setStoreSearching] = useState(false);
  const [storeResults, setStoreResults] = useState<Array<{ title: string; author?: string; detailUrl: string }>>([]);
  const [bookSources, setBookSources] = useState<any[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  // 社区提示词
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPrompt[]>([]);
  const [isCommunityPromptsLoading, setIsCommunityPromptsLoading] = useState(false);

  // Rebuild chapterStates when source switches or externalBook changes
  useEffect(() => {
    if (!open) return;
    const list = (activeSource === 'store' && externalBooks.length > 0) ? externalBooks[externalBooks.length - 1].chapters : bookRef.current.chapters; // Use latest external for states
    const initialStates = new Map<string, ChapterSummaryState>();
    list.forEach((chapter: any) => {
      initialStates.set(chapter.id, {
        chapterId: chapter.id,
        selected: false,
        status: (chapter as any).summary ? 'completed' : 'pending',
      });
    });
    setChapterStates(initialStates);
  }, [activeSource, externalBooks, open]);

  // Load book sources for bookstore tab
  useEffect(() => {
    const loadSources = async () => {
      if (activeSource !== 'store' || !open) return;
      if (bookSources.length > 0) return;
      setIsLoadingSources(true);
      try {
        const resp = await fetch('/api/get-book-sources');
        const data = await resp.json();
        if (data?.success) {
          const list = (data.sources || []).filter((s: any) => s.enabled);
          setBookSources(list);
          if (!selectedSourceId && list.length > 0) setSelectedSourceId(list[0].id);
        }
      } catch {}
      setIsLoadingSources(false);
    };
    loadSources();
  }, [activeSource, open, bookSources.length, selectedSourceId]);

  // AI params
  const [temperature, setTemperature] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.3;
    const saved = localStorage.getItem('plot-summary-temp');
    const n = saved ? parseFloat(saved) : 0.3;
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.3;
  });
  const [maxTokens, setMaxTokens] = useState<number>(() => {
    if (typeof window === 'undefined') return 512;
    const saved = localStorage.getItem('plot-summary-max-tokens');
    const n = saved ? parseInt(saved, 10) : 512;
    return Number.isFinite(n) ? Math.max(256, Math.min(4096, n)) : 512;
  });
  // 用户自定义：人设与提示词
  const DEFAULT_SUMMARY_SYS = '你是资深小说编辑，擅长剧情梳理与总结。请用客观、精炼的语言总结章节内容。';
  const DEFAULT_SUMMARY_PROMPT = '请对以下章节进行剧情总结，提炼关键情节、人物行动与情感变化。总结应简洁准确，不超过300字。若无前情提要，请独立基于当前章节正文进行总结，不要臆造前文。';
  const [summarySystemPrompt, setSummarySystemPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_SUMMARY_SYS;
    return localStorage.getItem('plot-summary-system') || DEFAULT_SUMMARY_SYS;
  });
  const [summaryPrompt, setSummaryPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_SUMMARY_PROMPT;
    return localStorage.getItem('plot-summary-user-prompt') || DEFAULT_SUMMARY_PROMPT;
  });

  // Initialize chapter states when dialog opens
  useEffect(() => {
    if (open) {
      const initialStates = new Map<string, ChapterSummaryState>();
      book.chapters.forEach(chapter => {
        initialStates.set(chapter.id, {
          chapterId: chapter.id,
          selected: false,
          status: chapter.summary ? 'completed' : 'pending',
        });
      });
      setChapterStates(initialStates);
      setIsGenerating(false);
      setCurrentProcessingIndex(0);
      setTotalSelected(0);
      // 加载社区提示词
      (async () => {
        try {
          setIsCommunityPromptsLoading(true);
          const list = await getPrompts();
          setCommunityPrompts(list);
        } catch {}
        finally { setIsCommunityPromptsLoading(false); }
      })();
    }
  }, [open]);

  const setChapterSelected = (chapterId: string, selected: boolean) => {
    setChapterStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(chapterId);
      if (state) {
        state.selected = selected;
        newStates.set(chapterId, state);
      }
      return newStates;
    });
  };

  const selectAll = () => {
    setChapterStates(prev => {
      const newStates = new Map(prev);
      const list = (activeSource === 'store' && externalBooks.length > 0) ? externalBooks[externalBooks.length - 1].chapters : bookRef.current.chapters;
      newStates.forEach((state, id) => {
        const chap = list.find(c => c.id === id);
        const hasContent = (chap?.content || '').trim().length > 0;
        // 书城模式：允许选择0字章节（将自动抓取正文）；当前书籍：仅选择有内容
        state.selected = activeSource === 'store' ? true : !!hasContent;
        newStates.set(id, state);
      });
      return newStates;
    });
  };

  const deselectAll = () => {
    setChapterStates(prev => {
      const newStates = new Map(prev);
      newStates.forEach((state, id) => {
        state.selected = false;
        newStates.set(id, state);
      });
      return newStates;
    });
  };

  // Helper: fetch chapter content from bookstore with retry
  const fetchExternalChapterContent = async (chapter: { url: string }, sourceId: string): Promise<string> => {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const qs = new URLSearchParams({ url: chapter.url || '', sourceId: sourceId || '' }).toString();
        const resp = await fetch(`/api/bookstore/chapter?${qs}`);
        const data = await resp.json();
        const content = data?.success && data?.chapter?.content ? String(data.chapter.content) : '';
        if (content.trim().length > 0) return content;
      } catch {}
      // small backoff between retries
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    return '';
  };

  const handleGenerateSummaries = async () => {
    const selectedChapterIds = Array.from(chapterStates.values())
      .filter(state => state.selected)
      .map(state => state.chapterId);

    if (selectedChapterIds.length === 0) {
      toast({
        title: '未选择章节',
        description: '请至少选择一个章节进行总结',
        variant: 'destructive',
      });
      return;
    }

    if (!canGenerate) {
      toast({
        title: '未配置AI',
        description: '请先在设置中配置AI提供商',
        variant: 'destructive',
      });
      return;
    }

    // Guard: bookstore mode requires a source and loaded external book
    if (activeSource === 'store') {
      if (!selectedSourceId) {
        toast({ title: '请选择书源', description: '在上方“来源选择-书城”中先选择书源', variant: 'destructive' });
        return;
      }
      if (externalBooks.length === 0) {
        toast({ title: '未加载书城目录', description: '请先通过“获取目录”载入目标书籍章节', variant: 'destructive' });
        return;
      }
    }

    setIsGenerating(true);
    setTotalSelected(selectedChapterIds.length);
    setCurrentProcessingIndex(0);
    cancelRequestedRef.current = false;

    let lastSummaryForContext = '';
    const workingBook = activeSource === 'store' && externalBooks.length > 0 ? externalBooks[externalBooks.length - 1] : { id: bookRef.current.id, title: bookRef.current.title, description: bookRef.current.description, chapters: bookRef.current.chapters.map(c => ({ id: c.id, title: c.title, url: c.url || '', content: c.content })) };
    const initialContext = (workingBook.description || '').trim();
    let processedCount = 0;

    try {
      for (const chapterId of selectedChapterIds) {
        if (cancelRequestedRef.current) break;
        setCurrentProcessingIndex(processedCount + 1);
        
        // Update status to generating
        setChapterStates(prev => {
          const newStates = new Map(prev);
          const state = newStates.get(chapterId);
          if (state) {
            state.status = 'generating';
            state.progress = '正在生成...';
            newStates.set(chapterId, state);
          }
          return newStates;
        });

        const chapter = workingBook.chapters.find((c: any) => c.id === chapterId) as any;
        if (!chapter) continue;
        const chapterIndex = workingBook.chapters.findIndex((c: any) => c.id === chapterId);
        const chapterNumber = chapterIndex + 1;

        // If external and missing content, fetch it (with retry) and show progress
        if (activeSource === 'store' && externalBooks.length > 0 && (!chapter.content || chapter.content.trim().length === 0)) {
          setChapterStates(prev => {
            const ns = new Map(prev);
            const st = ns.get(chapterId);
            if (st) { st.progress = '正在抓取正文...'; ns.set(chapterId, st); }
            return ns;
          });
          const fetched = await fetchExternalChapterContent(chapter, selectedSourceId || '');
          if (fetched) {
            chapter.content = fetched;
          }
        }

        // If still empty after possible fetch, mark error and continue
        if (!chapter.content || chapter.content.trim().length === 0) {
          setChapterStates(prev => {
            const newStates = new Map(prev);
            const state = newStates.get(chapterId);
            if (state) {
              state.status = 'error';
              state.progress = activeSource === 'store' ? '正文抓取失败或为空，已跳过' : '内容为空，已跳过';
              newStates.set(chapterId, state);
            }
            return newStates;
          });
          if (activeSource === 'store') {
            toast({ title: `第${chapterNumber}章抓取失败`, description: '未能获取到正文内容，已跳过该章', variant: 'destructive' });
          }
          continue;
        }

        // chapterNumber already computed above

        // Build prompt（支持自定义）
        let prompt = `${(summaryPrompt || DEFAULT_SUMMARY_PROMPT).trim()}\n\n`;
        
        if (lastSummaryForContext) {
          prompt += `【前情提要】\n${lastSummaryForContext}\n\n`;
        } else if (initialContext) {
          prompt += `【全局背景】\n书籍：${book.title}\n${initialContext}\n\n`;
        }
        
        prompt += `【第${chapterNumber}章：${chapter.title}】\n${chapter.content}`;

        // Generate summary via streaming
        let currentSummary = '';
        try {
          for await (const chunk of generateContentStream(prompt, {
            systemInstruction: (summarySystemPrompt || DEFAULT_SUMMARY_SYS).trim(),
            maxOutputTokens: maxTokens,
            temperature: temperature,
          })) {
            currentSummary += chunk;
            
            // Update progress with live output
            setChapterStates(prev => {
              const newStates = new Map(prev);
              const state = newStates.get(chapterId);
              if (state) {
                state.progress = currentSummary;
                newStates.set(chapterId, state);
              }
              return newStates;
            });

            // Throttled live write so思维导图实时刷新
            const now = Date.now();
            if (now - lastSyncTsRef.current > 400) {
              lastSyncTsRef.current = now;
              if (activeSource === 'store' && externalBooks.length > 0) {
                // Incremental push: only current chapter to avoid overwriting others
                window.dispatchEvent(new CustomEvent('mindmap:updateExternal', {
                  detail: {
                    bookId: workingBook.id,
                    title: workingBook.title,
                    chapter: { id: chapter.id, title: chapter.title, summary: currentSummary }
                  }
                }));
              } else {
                const base = bookRef.current;
                const tempChapters = base.chapters.map(c => c.id === chapterId ? { ...c, summary: currentSummary } : c);
                updateBook({ ...base, chapters: tempChapters });
              }
            }

            if (cancelRequestedRef.current) break;
          }

          // Save summary to book
          if (activeSource === 'store' && externalBooks.length > 0) {
            // Update using latest state to avoid losing previous summaries
            setExternalBooks(prev => {
              const idx = prev.findIndex(bk => bk.id === workingBook.id);
              if (idx === -1) return prev;
              const bookNow = prev[idx];
              const updatedChapters = bookNow.chapters.map(c => c.id === chapterId ? { ...c, summary: currentSummary.trim() } : c);
              const next = prev.slice();
              next[idx] = { ...bookNow, chapters: updatedChapters } as any;
              return next;
            });
            // Incremental push to mind map
            window.dispatchEvent(new CustomEvent('mindmap:updateExternal', {
              detail: {
                bookId: workingBook.id,
                title: workingBook.title,
                chapter: { id: chapter.id, title: chapter.title, summary: currentSummary.trim() }
              }
            }));
          } else {
            const baseFinal = bookRef.current;
            const updatedChapters = baseFinal.chapters.map(c => c.id === chapterId ? { ...c, summary: currentSummary.trim() } : c);
            updateBook({ ...baseFinal, chapters: updatedChapters });
          }

          // Update status to completed
          setChapterStates(prev => {
            const newStates = new Map(prev);
            const state = newStates.get(chapterId);
            if (state) {
              state.status = 'completed';
              state.progress = currentSummary.trim();
              newStates.set(chapterId, state);
            }
            return newStates;
          });

          // Use current summary as context for next chapter
          lastSummaryForContext = currentSummary.trim();
          processedCount++;

          if (cancelRequestedRef.current) break;

        } catch (error) {
          console.error(`Error generating summary for chapter ${chapterId}:`, error);
          
          setChapterStates(prev => {
            const newStates = new Map(prev);
            const state = newStates.get(chapterId);
            if (state) {
              state.status = 'error';
              state.progress = '生成失败';
              newStates.set(chapterId, state);
            }
            return newStates;
          });
          
          toast({
            title: `第${chapterNumber}章总结失败`,
            description: error instanceof Error ? error.message : '未知错误',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: '总结完成',
        description: `已完成 ${processedCount} 个章节的剧情总结`,
      });

    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCount = Array.from(chapterStates.values()).filter(s => s.selected).length;
  const progressPercent = totalSelected > 0 ? (currentProcessingIndex / totalSelected) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden z-[60] pb-2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            剧情总结
          </DialogTitle>
          <DialogDescription>
            选择章节后，AI将逐章生成剧情总结，并关联前文内容以保持连贯性。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 h-[60vh] overflow-y-auto pr-2">
        <div className="flex flex-col gap-4 pr-2">
          {/* 来源选择：当前书籍 / 书城 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">来源选择</CardTitle>
              <CardDescription className="text-xs">可在此切换“当前书籍”或“书城选书”进行总结</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="current">当前书籍</TabsTrigger>
                  <TabsTrigger value="store">书城</TabsTrigger>
                </TabsList>
                <TabsContent value="current" className="pt-3 text-sm text-muted-foreground">
                  使用当前书籍的章节列表进行总结。
                </TabsContent>
                <TabsContent value="store" className="pt-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">选择书源</Label>
                    {isLoadingSources ? (
                      <p className="text-sm text-muted-foreground">加载书源中...</p>
                    ) : bookSources.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-red-500">未找到可用书源，请先在书城页面配置书源</p>
                    ) : (
                      <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择书源" />
                        </SelectTrigger>
                        <SelectContent>
                          {bookSources.map((src: any) => (
                            <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                      <Label className="text-xs">搜索书名</Label>
                      <div className="flex gap-2">
                        <Input value={storeSearchKeyword} onChange={(e) => setStoreSearchKeyword(e.target.value)} placeholder="输入书名关键字，回车或点搜索" onKeyDown={async (e) => { if (e.key === 'Enter') { (e.target as any).blur(); const btn = document.getElementById('plot-search-btn'); (btn as any)?.click(); } }} />
                        <Button id="plot-search-btn" disabled={!selectedSourceId || !storeSearchKeyword || storeSearching} onClick={async () => {
                          setStoreSearching(true);
                          try {
                            const qs = new URLSearchParams({ q: storeSearchKeyword, sourceId: selectedSourceId }).toString();
                            const resp = await fetch(`/api/bookstore/search?${qs}`);
                            const data = await resp.json();
                            if (data?.success) setStoreResults(data.books || []);
                            else toast({ title: '搜索失败', description: data?.error || '未知错误', variant: 'destructive' });
                          } catch (e: any) {
                            toast({ title: '搜索失败', description: e?.message || '网络错误', variant: 'destructive' });
                          } finally { setStoreSearching(false); }
                        }}>搜索</Button>
                      </div>
                  </div>
                  {/* 搜索结果 */}
                  {storeResults.length > 0 && (
                    <div className="rounded-md border p-2 max-h-48 overflow-auto text-sm">
                      {storeResults.map((b, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b last:border-b-0">
                          <div className="min-w-0 pr-2">
                            <div className="font-medium truncate">{b.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{b.author || ''}</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setStoreBookUrl(b.detailUrl); }}>选择</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">或直接粘贴书籍详情URL</Label>
                    <div className="flex gap-2">
                      <Input value={storeBookUrl} onChange={(e) => setStoreBookUrl(e.target.value)} placeholder="粘贴书籍详情页（支持含options）" />
                      <Button disabled={!selectedSourceId || !storeBookUrl || storeLoading} onClick={async () => {
                        setStoreLoading(true);
                        try {
                          const qs = new URLSearchParams({ url: storeBookUrl, sourceId: selectedSourceId }).toString();
                          const resp = await fetch(`/api/bookstore/book?${qs}`);
                          const data = await resp.json();
                          if (data?.success && data?.book) {
                            const b = data.book;
                            const rawChapters: Array<{ title: string; url: string }> = (b.chapters || []) as Array<{ title: string; url: string }>;
                            const chapters = rawChapters.map((ch, idx) => ({ id: `ext-${idx}`, title: ch.title, url: ch.url, content: '' }));
                            // Check if book already exists by id
                            const bookId = `${selectedSourceId}:${b.detailUrl || storeBookUrl}`;
                            setExternalBooks(prev => {
                              if (prev.some(bk => bk.id === bookId)) return prev; // Skip duplicate
                              return [...prev, { id: bookId, title: b.title, description: b.description, chapters }];
                            });
                            setActiveSource('store');
                            toast({ title: '目录已载入', description: `${b.title} · 共 ${chapters.length} 章` });
                          } else {
                            toast({ title: '载入失败', description: data?.error || '未知错误', variant: 'destructive' });
                          }
                        } catch (e: any) {
                          toast({ title: '载入失败', description: e?.message || '网络错误', variant: 'destructive' });
                        } finally { setStoreLoading(false); }
                      }}>获取目录</Button>
                    </div>
                  </div>
                  {externalBooks.length > 0 && (
                    <div className="text-xs text-muted-foreground">已加载：{externalBooks[externalBooks.length - 1].title}（{externalBooks[externalBooks.length - 1].chapters.length} 章）</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          {/* AI settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI 设置</CardTitle>
              <CardDescription className="text-xs">可在此切换模型、调整温度与最大输出长度</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ModelSelector
                    compact={true}
                    selectedProviderId={selectedProviderId || ''}
                    selectedModelId={selectedModelId || ''}
                    onProviderChange={setSelectedProvider}
                    onModelChange={setSelectedModel}
                  />
                </div>
                <AIProviderSettings variant="ghost" showStatus={true} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">温度（{temperature.toFixed(2)}）</Label>
                  <Slider value={[temperature]} min={0} max={1} step={0.05} onValueChange={(v) => {
                    const val = Array.isArray(v) ? v[0] : (v as unknown as number);
                    setTemperature(val);
                    if (typeof window !== 'undefined') localStorage.setItem('plot-summary-temp', String(val));
                  }} />
                </div>
                <div>
                  <Label className="text-xs">最大输出长度（tokens）：{maxTokens}</Label>
                  <Slider value={[maxTokens]} min={256} max={4096} step={256} onValueChange={(v) => {
                    const val = Array.isArray(v) ? v[0] : (v as unknown as number);
                    setMaxTokens(val);
                    if (typeof window !== 'undefined') localStorage.setItem('plot-summary-max-tokens', String(val));
                  }} />
                </div>
              </div>
              {/* 自定义人设与提示词 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">人设（System Prompt）</Label>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(id) => {
                      const p = communityPrompts.find(x => x.id === id);
                      if (p) setSummarySystemPrompt(p.prompt);
                    }} disabled={isCommunityPromptsLoading}>
                      <SelectTrigger className="h-8 w-[180px] ml-auto">
                        <SelectValue placeholder={<div className='flex items-center gap-2'><Users className="h-4 w-4"/> 社区提示词</div>} />
                      </SelectTrigger>
                      <SelectContent>
                        {isCommunityPromptsLoading ? (
                          <SelectItem value="loading" disabled>加载中...</SelectItem>
                        ) : (
                          communityPrompts.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea rows={3} value={summarySystemPrompt} onChange={(e) => {
                    setSummarySystemPrompt(e.target.value);
                    if (typeof window !== 'undefined') localStorage.setItem('plot-summary-system', e.target.value);
                  }} placeholder={DEFAULT_SUMMARY_SYS} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">总结提示词</Label>
                  <Textarea rows={3} value={summaryPrompt} onChange={(e) => {
                    setSummaryPrompt(e.target.value);
                    if (typeof window !== 'undefined') localStorage.setItem('plot-summary-user-prompt', e.target.value);
                  }} placeholder={DEFAULT_SUMMARY_PROMPT} />
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Selection controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={isGenerating}>
                {activeSource === 'store' ? '全选' : '全选（仅有内容）'}
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} disabled={isGenerating}>
                取消全选
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              已选择 {selectedCount} / {(activeSource === 'store' && externalBooks.length > 0 ? externalBooks[externalBooks.length - 1].chapters.length : book.chapters.length)} 章
            </div>
          </div>

          {/* Progress bar during generation */}
          {isGenerating && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">生成进度</CardTitle>
                <CardDescription>
                  正在处理第 {currentProcessingIndex} / {totalSelected} 章
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progressPercent} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Chapter list */}
          <div className="space-y-2">
            {(activeSource === 'store' && externalBooks.length > 0 ? externalBooks[externalBooks.length - 1].chapters : book.chapters).map((chapter: any, index) => {
              const state = chapterStates.get(chapter.id);
              if (!state) return null;

              return (
                <Card
                  key={chapter.id}
                  className={`transition-all ${
                    state.selected ? 'border-primary bg-primary/5' : ''
                  } ${state.status === 'generating' ? 'animate-pulse-fast' : ''}`}
                  // 仅由复选框和label控制选中，避免双事件抵消
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                        <Checkbox
                          checked={state.selected}
                          onCheckedChange={(checked) => setChapterSelected(chapter.id, Boolean(checked))}
                          onClick={(e) => { e.stopPropagation(); }}
                          onKeyDown={(e) => { e.stopPropagation(); }}
                          disabled={isGenerating || (activeSource !== 'store' && !(chapter.content || '').trim().length)}
                          className="mt-1"
                        />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <label className="text-sm cursor-pointer select-none" onClick={() => {
                              if (isGenerating) return;
                              if (activeSource !== 'store' && !(chapter.content || '').trim().length) return;
                              setChapterSelected(chapter.id, !state.selected);
                            }}>
                            第{index + 1}章：{chapter.title}
                          </label>
                          {state.status === 'completed' && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                          {state.status === 'generating' && (
                            <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                          )}
                          {state.status === 'error' && (
                            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                        </div>
                          <CardDescription className="text-xs">
                            {chapter.content.length} 字
                            {!((chapter.content || '').trim().length) && (activeSource === 'store' ? ' • 未加载正文（将自动抓取）' : ' • 空章（不可选）')}
                            {chapter.summary && !state.progress && ' • 已有总结'}
                          </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {/* Show progress or existing summary */}
                  {(state.progress || (state.status === 'completed' && chapter.summary)) && (
                    <CardContent className="pt-0">
                      <div className="p-3 bg-muted/50 rounded-md text-sm text-foreground/80 whitespace-pre-wrap">
                        {state.progress || chapter.summary}
                        {state.status === 'generating' && (
                          <span className="animate-pulse">▋</span>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
        </div>

        <DialogFooter>
          {isGenerating ? (
            <Button
              variant="outline"
              onClick={() => { cancelRequestedRef.current = true; }}
            >
              取消生成
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
          <Button onClick={handleGenerateSummaries} disabled={isGenerating || selectedCount === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                开始生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

