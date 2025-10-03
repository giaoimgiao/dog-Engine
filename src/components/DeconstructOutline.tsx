
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { deconstructOutline } from '@/ai/flows/refine-chapter-with-world-info';
import { Edit, Loader2, WandSparkles, FileText, Send, BookUp } from 'lucide-react';
import type { BookstoreBookDetail, BookstoreChapterContent } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { 
    generateContent, 
    listGeminiModels, 
    hasApiKey, 
    getDefaultModel,
    type GeminiModel 
} from '@/lib/gemini-client';
import { GeminiSettings } from './GeminiSettings';

interface DeconstructOutlineProps {
  bookDetailUrl: string;
  sourceId: string;
}

const DECONSTRUCT_OUTLINE_KEY = 'deconstruct-outline-result';

export function DeconstructOutline({ bookDetailUrl, sourceId }: DeconstructOutlineProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [bookDetail, setBookDetail] = useState<BookstoreBookDetail | null>(null);
  const [selectedChapterUrl, setSelectedChapterUrl] = useState<string>('');
  const [isFetchingBook, setIsFetchingBook] = useState(false);
  const [isFetchingChapter, setIsFetchingChapter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outline, setOutline] = useState<string>('');

  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);
  const [isModelListLoading, setIsModelListLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('');
  const [maxTokens, setMaxTokens] = useState<number>(() => {
    if (typeof window === 'undefined') return 2048;
    const saved = localStorage.getItem('deconstruct-max-tokens');
    const n = saved ? parseInt(saved, 10) : 2048;
    return Number.isFinite(n) && n > 256 ? n : 2048;
  });

  useEffect(() => {
    async function fetchInitialData() {
      if (!isOpen) return;

      // Fetch book detail if not already fetched
      if (!bookDetail) {
        setIsFetchingBook(true);
        try {
          const res = await fetch(`/api/bookstore/book?url=${encodeURIComponent(bookDetailUrl)}&sourceId=${sourceId}`);
          if (!res.ok) throw new Error('获取书籍详情失败');
          const data = await res.json();
          if (data.success) {
            setBookDetail(data.book);
          } else {
            throw new Error(data.error || '获取书籍详情失败');
          }
        } catch (err: any) {
          toast({ title: '错误', description: err.message, variant: 'destructive' });
        } finally {
          setIsFetchingBook(false);
        }
      }

      // Fetch models if not already fetched - 使用前端API
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
            toast({
                title: '模型列表加载失败',
                description: '无法从API获取语言模型列表，将使用默认模型。',
                variant: 'destructive',
            });
             setSelectedModel(getDefaultModel());
        } finally {
            setIsModelListLoading(false);
        }
      }
    }
    fetchInitialData();
  }, [isOpen, bookDetail, bookDetailUrl, sourceId, availableModels.length, toast]);
  
  const handleGenerate = async () => {
    if (!selectedChapterUrl) {
      toast({ title: '请选择一个章节', variant: 'destructive' });
      return;
    }

    if (!hasApiKey()) {
      toast({ 
        title: '请先配置API密钥', 
        description: '请点击右上角AI设置按钮配置您的Gemini API密钥',
        variant: 'destructive' 
      });
      return;
    }

    setIsGenerating(true);
    setIsFetchingChapter(true);
    setOutline('');
    
    try {
        // 1. Fetch chapter content
        const chapterRes = await fetch(`/api/bookstore/chapter?url=${encodeURIComponent(selectedChapterUrl)}&sourceId=${sourceId}`);
        if (!chapterRes.ok) throw new Error('获取章节内容失败');
        const chapterData = await chapterRes.json();
        if (!chapterData.success) throw new Error(chapterData.error || '获取章节内容失败');
        const chapterContent: BookstoreChapterContent = chapterData.chapter;
        setIsFetchingChapter(false);

        // 2. Send to AI - 使用前端API
        const prompt = `请分析以下章节内容，提取出详细的写作细纲。包括：
1. 主要情节发展
2. 关键人物动作和对话
3. 场景描写要点
4. 情绪氛围营造
5. 冲突和转折点

章节内容：
${chapterContent.content}`;

        const systemInstruction = `你是一个专业的网络小说写作分析师，擅长从完整章节中提取写作细纲。
请提供详细、结构化的细纲，帮助作者理解章节的写作手法。`;

        const result = await generateContent(
          selectedModel,
          prompt,
          {
            temperature: 0.3, // 低温度保证分析准确性
            maxOutputTokens: maxTokens,
            systemInstruction,
          }
        );
        
        setOutline(result);
        
    } catch(err: any) {
        toast({ title: '生成细纲失败', description: err.message, variant: 'destructive' });
        setIsFetchingChapter(false);
    } finally {
        setIsGenerating(false);
    }
  }

  const applyToEditor = () => {
    localStorage.setItem(DECONSTRUCT_OUTLINE_KEY, outline);
    toast({
      title: '操作成功',
      description: '细纲已保存，请到写作页面粘贴使用。'
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-black/50 text-white hover:bg-black/70 border-none">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <WandSparkles/> 拆解细纲
            </div>
            <GeminiSettings variant="ghost" showStatus={true} />
          </DialogTitle>
          <DialogDescription>
            选择一个章节，AI将为你提炼核心剧情脉络。
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {isFetchingBook ? (
                 <div className="flex items-center justify-center h-24">
                    <Loader2 className="animate-spin mr-2"/> 正在获取书籍信息...
                </div>
            ) : bookDetail ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor='chapter-select'>选择章节</Label>
                    <Select onValueChange={setSelectedChapterUrl} value={selectedChapterUrl}>
                      <SelectTrigger id="chapter-select">
                        <SelectValue placeholder="选择一个章节进行拆解" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {bookDetail.chapters.map((chapter, index) => (
                          <SelectItem key={chapter.url + index} value={chapter.url}>{chapter.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <div className="mt-3">
                      <Label htmlFor='max-tokens-select'>最大输出长度</Label>
                      <Select 
                        value={String(maxTokens)} 
                        onValueChange={(v) => {
                          const n = parseInt(v, 10);
                          setMaxTokens(n);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('deconstruct-max-tokens', String(n));
                          }
                        }}
                      >
                        <SelectTrigger id='max-tokens-select'>
                          <SelectValue placeholder="选择最大输出长度" />
                        </SelectTrigger>
                        <SelectContent>
                          {[512, 1024, 1536, 2048, 3072, 4096, 6144, 8192].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">超长章节建议搭配较大值；若提示 MAX_TOKENS，可适当增大或分段分析。</p>
                    </div>
                  </div>
                </div>
            ) : (
                <p>无法加载书籍详情。</p>
            )}

            { (isFetchingChapter || isGenerating) && (
                 <div className="flex items-center justify-center h-24">
                    <Loader2 className="animate-spin mr-2"/> 
                    {isFetchingChapter ? '正在获取章节内容...' : 'AI正在分析剧情...'}
                </div>
            )}
            
            {outline && (
                <div className="space-y-2">
                    <Label>生成结果</Label>
                    <ScrollArea className="h-64 w-full rounded-md border p-4">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{outline}</p>
                    </ScrollArea>
                </div>
            )}
        </div>
        <DialogFooter className="justify-between">
          <div>
            {outline && (
               <Button onClick={applyToEditor} variant="secondary">
                 <Send className="mr-2"/> 应用到写作助手
               </Button>
            )}
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
                <Button variant="ghost">关闭</Button>
            </DialogClose>
            <Button onClick={handleGenerate} disabled={!selectedChapterUrl || isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <WandSparkles className="mr-2"/>}
                开始生成
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
