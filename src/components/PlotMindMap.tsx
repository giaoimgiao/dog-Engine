'use client';

import { useState, useRef } from 'react';
import type { Book, Chapter } from '@/lib/types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Network, ChevronRight, ChevronDown, FileText, Minimize2, Maximize2, ArrowLeft, BookOpen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface PlotMindMapProps {
  book: Book;
  externalBooks: Array<Book>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TreeNodeProps {
  chapter: Chapter;
  index: number;
  isLast: boolean;
}

function TreeNode({ chapter, index, isLast }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSummary = !!(chapter as any).summary;
  const wordCount = hasSummary
    ? ((chapter as any).summary ? String((chapter as any).summary).length : 0)
    : ((chapter.content || '').length);

  return (
    <div className="relative">
      {/* Horizontal connector line */}
      <div className="absolute left-0 top-8 w-8 h-px bg-gradient-to-r from-primary/50 to-border" />
      
      {/* Vertical line to next sibling */}
      {!isLast && (
        <div className="absolute left-0 top-8 bottom-0 w-px bg-gradient-to-b from-primary/30 to-border" />
      )}
      
      <div className="ml-8 mb-4">
        <Card className={cn(
          "transition-all hover:shadow-lg border-l-4",
          hasSummary 
            ? "border-l-primary bg-gradient-to-r from-primary/5 to-background" 
            : "border-l-muted bg-muted/20"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              {/* Node indicator */}
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold",
                hasSummary 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm truncate">{chapter.title}</CardTitle>
                  {hasSummary && (
                    <Badge variant="default" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      已总结
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-1">
                  {wordCount} 字{hasSummary ? ' · 已总结' : ' · 未生成总结'}
                </CardDescription>
              </div>

              {/* Expand/collapse button */}
              {hasSummary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="flex-shrink-0"
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </CardHeader>
          
          {/* Expanded summary content */}
          {expanded && hasSummary && (
            <CardContent className="pt-0 animate-in slide-in-from-top-2">
              <div className="p-4 bg-primary/5 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap border-l-2 border-primary">
                {chapter.summary}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function PlotMindMap({ book, externalBooks, open, onOpenChange }: PlotMindMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const booksToShow: Book[] = [book, ...externalBooks];
  const totalChapters = booksToShow.reduce((acc, b) => acc + b.chapters.length, 0);
  const summaryCount = booksToShow.reduce((acc, b) => acc + b.chapters.filter(c => (c as any).summary).length, 0);

  // Reset to book wall when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setSelectedBookId(null);
    onOpenChange(newOpen);
  };

  const selectedBook = selectedBookId ? booksToShow.find(b => b.id === selectedBookId) : null;

  // Export all books (current + external) as JSON (chapters include only id, title, summary)
  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      books: booksToShow.map(b => ({
        id: b.id,
        title: b.title,
        description: (b as any).description || '',
        chapters: b.chapters.map(c => ({ id: c.id, title: c.title, summary: (c as any).summary || '' }))
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    a.download = `plot-mindmap-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 0);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const books: Array<any> = Array.isArray(data)
        ? data
        : Array.isArray(data?.books) ? data.books : [];
      for (const b of books) {
        if (!b) continue;
        const chapters = Array.isArray(b.chapters) ? b.chapters.map((c: any) => ({ id: c.id, title: c.title, summary: c.summary || '' })) : [];
        window.dispatchEvent(new CustomEvent('mindmap:updateExternal', {
          detail: { bookId: b.id || `ext:${b.title || ''}`, title: b.title || '', chapters }
        }));
      }
    } catch (err) {
      console.error('Import mindmap failed', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        "flex flex-col overflow-hidden z-[60]",
        isFullscreen ? "max-w-full max-h-full w-screen h-screen" : "max-w-6xl max-h-[90vh]"
      )}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <DialogTitle>
                {selectedBook ? selectedBook.title : '剧情脉络图 - 书架'}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
              <Button variant="outline" size="sm" onClick={handleImportClick}>导入</Button>
              <Button variant="outline" size="sm" onClick={handleExport}>导出</Button>
              {!selectedBook && (
                <div className="text-xs text-muted-foreground mr-2">
                  {booksToShow.length} 本书 · {summaryCount} / {totalChapters} 章已总结
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {totalChapters === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>暂无章节</p>
            </div>
          </div>
        ) : !selectedBook ? (
          // Book wall grid view
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {booksToShow.map((b) => {
                const bookSummaryCount = b.chapters.filter(c => !!(c as any).summary).length;
                const bookTotalChapters = b.chapters.length;
                const percent = bookTotalChapters > 0 ? Math.round((bookSummaryCount / bookTotalChapters) * 100) : 0;
                
                return (
                  <Card 
                    key={b.id} 
                    className="relative cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all transform hover:scale-[1.02] group"
                    onClick={() => setSelectedBookId(b.id)}
                  >
                    {b.id !== book.id && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-80 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent('mindmap:removeExternal', { detail: { bookId: b.id } }));
                        }}
                        title="移除这本导入书籍"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-2">
                        <BookOpen className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                            {b.title}
                          </CardTitle>
                        </div>
                      </div>
                      <CardDescription className="text-xs line-clamp-2 mt-2">
                        {b.description || '暂无简介'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">章节总数</span>
                          <Badge variant="outline">{bookTotalChapters} 章</Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">已总结</span>
                          <Badge variant={bookSummaryCount > 0 ? "default" : "secondary"}>
                            {bookSummaryCount} 章 ({percent}%)
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          // Mind map view for selected book
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedBookId(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                返回书架
              </Button>
              <div className="flex-1 text-sm text-muted-foreground">
                {selectedBook.chapters.filter(c => !!(c as any).summary).length} / {selectedBook.chapters.length} 章已总结
              </div>
            </div>
            
            {selectedBook.chapters.filter(c => !!(c as any).summary).length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>该书籍暂无章节总结</p>
                  <p className="text-xs mt-2">请先使用"剧情总结"功能生成章节总结</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-0 select-text pb-4">
                  {/* Root node */}
                  <Card className="mb-6 border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <BookOpen className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg">{selectedBook.title}</CardTitle>
                          <CardDescription className="mt-1">{selectedBook.description || '暂无简介'}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Vertical trunk line */}
                  <div className="h-6 w-px bg-gradient-to-b from-primary to-border ml-6 mb-2" />
                  
                  {/* Chapter tree */}
                  <div className="pl-6 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-transparent" />
                    {selectedBook.chapters.map((chapter, index) => (
                      <TreeNode 
                        key={chapter.id} 
                        chapter={chapter} 
                        index={index} 
                        isLast={index === selectedBook.chapters.length - 1} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
