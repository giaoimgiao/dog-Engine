'use client';

import type { Book, Chapter, CommunityPrompt } from '@/lib/types';
import { Button } from './ui/button';
import { Plus, Trash2, FileText, Edit, Download, Copy, Bot, Users, Loader2, WandSparkles } from 'lucide-react';
import { cn, generateUUID } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  generateContent, 
  listGeminiModels, 
  hasApiKey, 
  getDefaultModel,
  type GeminiModel 
} from '@/lib/gemini-client';
import { getPrompts } from '@/lib/actions/community';
import { GeminiSettings } from './GeminiSettings';

interface ChapterManagerProps {
  book: Book;
  updateBook: (book: Book) => void;
  activeChapter: Chapter | null;
  setActiveChapter: (chapter: Chapter | null) => void;
}

export default function ChapterManager({ book, updateBook, activeChapter, setActiveChapter }: ChapterManagerProps) {
  const { toast } = useToast();
  const [isRenaming, setIsRenaming] = useState<Chapter | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  
  // Fetch dialog state
  const [fetchDialogChapter, setFetchDialogChapter] = useState<Chapter | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isAiRewriting, setIsAiRewriting] = useState(false);
  
  // AI rewrite settings
  const DEFAULT_REWRITE_PERSONA = `你是一个专业的网络小说仿写助手。请根据原文内容，保持故事情节和人物设定不变，但用不同的表达方式重新创作，使文字更加生动有趣。`;
  const DEFAULT_REWRITE_PROMPT = `请仿写以下章节内容，要求：
1. 保持原有故事情节和人物关系
2. 改变叙述方式和表达手法
3. 丰富细节描写和对话
4. 保持章节的整体长度`;

  const [rewritePersona, setRewritePersona] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_REWRITE_PERSONA;
    return localStorage.getItem('chapter-rewrite-persona') || DEFAULT_REWRITE_PERSONA;
  });
  const [rewritePrompt, setRewritePrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_REWRITE_PROMPT;
    return localStorage.getItem('chapter-rewrite-prompt') || DEFAULT_REWRITE_PROMPT;
  });
  
  // AI model settings
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);
  const [isModelListLoading, setIsModelListLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('');
  const [maxTokens, setMaxTokens] = useState<number>(() => {
    if (typeof window === 'undefined') return 4096;
    const saved = localStorage.getItem('chapter-rewrite-max-tokens');
    const n = saved ? parseInt(saved, 10) : 4096;
    return Number.isFinite(n) && n > 256 ? n : 4096;
  });
  
  // Community prompts
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPrompt[]>([]);
  const [isCommunityPromptsLoading, setIsCommunityPromptsLoading] = useState(false);

  // Load models and community prompts when fetch dialog opens
  useEffect(() => {
    if (!fetchDialogChapter) return;
    
    async function loadDialogData() {
      // Load models
      if (availableModels.length === 0) {
        setIsModelListLoading(true);
        try {
          if (hasApiKey()) {
            const models = await listGeminiModels();
            setAvailableModels(models);
            const flashModel = models.find(m => m.id.includes('gemini-2.5-flash') || m.id.includes('2.5-flash'));
            if (flashModel) {
              setSelectedModel(flashModel.id);
            } else if (models.length > 0) {
              setSelectedModel(models[0].id);
            }
          } else {
            // 未配置API密钥时使用默认列表
            const defaultModels: GeminiModel[] = [
              { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
              { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
            ];
            setAvailableModels(defaultModels);
            setSelectedModel(getDefaultModel());
          }
        } catch (error) {
          console.error("Failed to fetch models:", error);
          setSelectedModel(getDefaultModel());
        } finally {
          setIsModelListLoading(false);
        }
      }

      // Load community prompts
      try {
        setIsCommunityPromptsLoading(true);
        const prompts = await getPrompts();
        setCommunityPrompts(prompts);
      } catch (error) {
        console.error('Failed to load community prompts:', error);
      } finally {
        setIsCommunityPromptsLoading(false);
      }
    }
    
    loadDialogData();
  }, [fetchDialogChapter, availableModels.length]);

  const handleAddChapter = () => {
    const newChapter: Chapter = {
      id: generateUUID(),
      title: `新章节 ${book.chapters.length + 1}`,
      content: '',
    };
    const updatedBook = { ...book, chapters: [...book.chapters, newChapter] };
    updateBook(updatedBook);
    setActiveChapter(newChapter);
  };

  const handleDeleteChapter = (chapterId: string) => {
    const updatedChapters = book.chapters.filter((c) => c.id !== chapterId);
    const updatedBook = { ...book, chapters: updatedChapters };
    updateBook(updatedBook);
    if (activeChapter?.id === chapterId) {
      setActiveChapter(updatedChapters.length > 0 ? updatedChapters[0] : null);
    }
  };
  
  const handleRenameChapter = () => {
    if (!isRenaming || !newChapterTitle.trim()) return;

    const updatedChapters = book.chapters.map(c => 
      c.id === isRenaming.id ? { ...c, title: newChapterTitle.trim() } : c
    );
    const updatedBook = { ...book, chapters: updatedChapters };
    updateBook(updatedBook);
    if (activeChapter?.id === isRenaming.id) {
        setActiveChapter(updatedChapters.find(c => c.id === isRenaming.id) || null);
    }
    handleCloseRenameDialog();
  };

  const handleCloseRenameDialog = () => {
    setIsRenaming(null);
    setNewChapterTitle('');
  }

  const openRenameDialog = (chapter: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(chapter);
    setNewChapterTitle(chapter.title);
  }

  // Open fetch dialog instead of directly fetching
  const openFetchDialog = (chapter: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setFetchDialogChapter(chapter);
  }

  const closeFetchDialog = () => {
    setFetchDialogChapter(null);
    setIsFetching(false);
    setIsAiRewriting(false);
  }

  // Fetch original content and copy directly to editor
  const handleDirectCopy = async () => {
    if (!fetchDialogChapter || !book.sourceId || !fetchDialogChapter.url) return;
    
    setIsFetching(true);
    try {
      const res = await fetch(`/api/bookstore/chapter?url=${encodeURIComponent(fetchDialogChapter.url)}&sourceId=${book.sourceId}`);
      if (!res.ok) throw new Error('获取章节内容失败');
      const data = await res.json();
      if (!data?.success) throw new Error(data.error || '获取章节内容失败');
      
      const updatedChapters = book.chapters.map(c => 
        c.id === fetchDialogChapter.id 
          ? { ...c, content: data.chapter.content, title: fetchDialogChapter.title || data.chapter.title } 
          : c
      );
      const updatedBook = { ...book, chapters: updatedChapters };
      updateBook(updatedBook);
      setActiveChapter(updatedChapters.find(c => c.id === fetchDialogChapter.id) || null);
      
      toast({ title: '成功', description: '原文已复制到编辑器' });
      closeFetchDialog();
    } catch (error: any) {
      toast({ title: '错误', description: error.message, variant: 'destructive' });
    } finally {
      setIsFetching(false);
    }
  }

  // Fetch original content and AI rewrite
  const handleAiRewrite = async () => {
    if (!fetchDialogChapter || !book.sourceId || !fetchDialogChapter.url) return;
    
    if (!hasApiKey()) {
      toast({ 
        title: '请先配置API密钥', 
        description: '请点击AI设置按钮配置您的Gemini API密钥',
        variant: 'destructive' 
      });
      return;
    }

    setIsFetching(true);
    setIsAiRewriting(true);
    
    try {
      // 1. Fetch original content
      const res = await fetch(`/api/bookstore/chapter?url=${encodeURIComponent(fetchDialogChapter.url)}&sourceId=${book.sourceId}`);
      if (!res.ok) throw new Error('获取章节内容失败');
      const data = await res.json();
      if (!data?.success) throw new Error(data.error || '获取章节内容失败');
      
      // 2. AI rewrite
      const prompt = `${rewritePrompt}\n\n原文内容：\n${data.chapter.content}`;
      const result = await generateContent(
        selectedModel,
        prompt,
        {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
          systemInstruction: rewritePersona,
        }
      );
      
      const updatedChapters = book.chapters.map(c => 
        c.id === fetchDialogChapter.id 
          ? { ...c, content: result, title: fetchDialogChapter.title || data.chapter.title } 
          : c
      );
      const updatedBook = { ...book, chapters: updatedChapters };
      updateBook(updatedBook);
      setActiveChapter(updatedChapters.find(c => c.id === fetchDialogChapter.id) || null);
      
      toast({ title: '成功', description: 'AI仿写完成，内容已添加到编辑器' });
      closeFetchDialog();
    } catch (error: any) {
      toast({ title: 'AI仿写失败', description: error.message, variant: 'destructive' });
    } finally {
      setIsFetching(false);
      setIsAiRewriting(false);
    }
  }

  // Persist settings to localStorage
  const persistRewritePersona = (text: string) => {
    setRewritePersona(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chapter-rewrite-persona', text);
    }
  };
  const persistRewritePrompt = (text: string) => {
    setRewritePrompt(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chapter-rewrite-prompt', text);
    }
  };

  const handleCommunityPromptSelect = (promptId: string) => {
    const selected = communityPrompts.find(p => p.id === promptId);
    if (selected) {
      persistRewritePersona(selected.prompt);
      toast({ title: '已应用社区提示词', description: `已套用：${selected.name}` });
    }
  }

  return (
    <div className="flex flex-col h-full">
        <div className="p-2 flex-shrink-0">
            <Button onClick={handleAddChapter} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                新建章节
            </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
            {book.chapters.length > 0 ? (
                <ul className="space-y-1 p-2">
                {book.chapters.map((chapter) => (
                    <li key={chapter.id}>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveChapter(chapter)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveChapter(chapter); }}
                        className={cn(
                        'w-full text-left p-2 rounded-md flex items-center justify-between group cursor-pointer',
                        activeChapter?.id === chapter.id
                            ? 'bg-primary/20 text-primary-foreground'
                            : 'hover:bg-accent/50'
                        )}
                    >
                        <span className="truncate pr-2">{chapter.title}</span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                           {chapter.url && book.sourceId && (
                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => openFetchDialog(chapter, e)} title="抓取章节内容">
                                <Download className="h-4 w-4" />
                              </Button>
                           )}
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => openRenameDialog(chapter, e)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>确定要删除此章节吗？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        此操作无法撤销。章节内容将被永久删除。
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteChapter(chapter.id)} className="bg-destructive hover:bg-destructive/90">删除</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    </li>
                ))}
                </ul>
            ) : (
                <div className="text-center p-4 text-muted-foreground text-sm">
                    暂无章节
                </div>
            )}
        </div>

        {/* Rename Dialog */}
        <Dialog open={!!isRenaming} onOpenChange={(open) => !open && handleCloseRenameDialog()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>重命名章节</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="chapter-name">新章节名</Label>
                    <Input id="chapter-name" value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary" onClick={handleCloseRenameDialog}>取消</Button>
                    </DialogClose>
                    <Button onClick={handleRenameChapter}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Fetch Dialog */}
        <Dialog open={!!fetchDialogChapter} onOpenChange={(open) => !open && closeFetchDialog()}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            抓取章节内容
                        </div>
                        <GeminiSettings variant="ghost" showStatus={true} />
                    </DialogTitle>
                    <DialogDescription>
                        选择处理方式：直接复制原文到编辑器，或使用AI仿写后添加到编辑器。
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6 py-4">
                        {/* 快速操作 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button 
                                onClick={handleDirectCopy} 
                                disabled={isFetching}
                                className="h-16 flex-col gap-2"
                                variant="outline"
                            >
                                {isFetching && !isAiRewriting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Copy className="h-5 w-5" />
                                )}
                                <span>直接复制原文</span>
                            </Button>
                            <Button 
                                onClick={handleAiRewrite} 
                                disabled={isFetching || !hasApiKey()}
                                className="h-16 flex-col gap-2"
                                variant="outline"
                            >
                                {isAiRewriting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <WandSparkles className="h-5 w-5" />
                                )}
                                <span>AI仿写</span>
                            </Button>
                        </div>

                        {/* AI仿写设置 */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Bot className="h-4 w-4" />
                                AI仿写设置
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* AI人设 */}
                                <div className="space-y-2">
                                    <Label htmlFor="rewrite-persona">AI 人设 / 系统指令</Label>
                                    <div className="flex items-center gap-2">
                                        <Select onValueChange={handleCommunityPromptSelect} disabled={isCommunityPromptsLoading}>
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue placeholder={<div className='flex items-center gap-2'><Users className="h-4 w-4"/>社区提示词</div>} />
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
                                        <Button variant="outline" size="sm" onClick={() => persistRewritePersona(DEFAULT_REWRITE_PERSONA)}>重置默认</Button>
                                    </div>
                                    <Textarea 
                                        id="rewrite-persona" 
                                        rows={4} 
                                        value={rewritePersona} 
                                        onChange={(e) => persistRewritePersona(e.target.value)} 
                                        placeholder="输入或粘贴AI人设" 
                                    />
                                </div>

                                {/* 仿写要求 */}
                                <div className="space-y-2">
                                    <Label htmlFor="rewrite-prompt">仿写要求</Label>
                                    <Button variant="outline" size="sm" onClick={() => persistRewritePrompt(DEFAULT_REWRITE_PROMPT)}>重置默认</Button>
                                    <Textarea 
                                        id="rewrite-prompt" 
                                        rows={4} 
                                        value={rewritePrompt} 
                                        onChange={(e) => persistRewritePrompt(e.target.value)} 
                                        placeholder="输入仿写要求" 
                                    />
                                </div>
                            </div>

                            {/* 模型设置 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor='model-select'>语言模型</Label>
                                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isModelListLoading}>
                                        <SelectTrigger id='model-select'>
                                            <SelectValue placeholder={isModelListLoading ? "加载中..." : "选择一个模型"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableModels.map(model => (
                                                <SelectItem key={model.id} value={model.id}>{model.displayName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {hasApiKey() ? (
                                            <span className="text-green-600 dark:text-green-400">✓ 使用您的API密钥</span>
                                        ) : (
                                            <span className="text-amber-600 dark:text-amber-400">⚠ 请先配置API密钥</span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor='max-tokens-select'>最大输出长度</Label>
                                    <Select 
                                        value={String(maxTokens)} 
                                        onValueChange={(v) => {
                                            const n = parseInt(v, 10);
                                            setMaxTokens(n);
                                            if (typeof window !== 'undefined') {
                                                localStorage.setItem('chapter-rewrite-max-tokens', String(n));
                                            }
                                        }}
                                    >
                                        <SelectTrigger id='max-tokens-select'>
                                            <SelectValue placeholder="选择最大输出长度" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1024, 2048, 4096, 6144, 8192].map(n => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">较长章节建议使用更大的输出长度</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary" disabled={isFetching}>关闭</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}