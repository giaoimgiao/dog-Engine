
'use client';

import { useState, useEffect } from 'react';
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
import { Edit, Loader2, WandSparkles, Send, Users } from 'lucide-react';
import type { BookstoreBookDetail, BookstoreChapterContent, CommunityPrompt } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { getPrompts } from '@/lib/actions/community';
import { useAI } from '@/hooks/useAI';
import { useAIConfig } from '@/hooks/useAIConfig';
import ModelSelector from './ModelSelector';
import { AIProviderSettings } from './AIProviderSettings';

interface DeconstructOutlineProps {
  bookDetailUrl: string;
  sourceId: string;
}

const DECONSTRUCT_OUTLINE_KEY = 'deconstruct-outline-result';

export function DeconstructOutline({ bookDetailUrl, sourceId }: DeconstructOutlineProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [bookDetail, setBookDetail] = useState<BookstoreBookDetail | null>(null);
  const [selectedChapterUrl, setSelectedChapterUrl] = useState<string>('');
  const [isFetchingBook, setIsFetchingBook] = useState(false);
  const [isFetchingChapter, setIsFetchingChapter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outline, setOutline] = useState<string>('');

  // 使用统一AI配置和调用
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();
  const { generateContent: aiGenerateContent, canGenerate } = useAI();

  // 用户自定义提示相关
  const DEFAULT_PERSONA = `你是一个专业的网络小说写作分析师，擅长从完整章节中提取写作细纲。\n请提供详细、结构化的细纲，帮助作者理解章节的写作手法。`;
  const DEFAULT_PROMPT_TEMPLATE = `请分析以下章节内容，提取出详细的写作细纲。包括：\n1. 主要情节发展\n2. 关键人物动作和对话\n3. 场景描写要点\n4. 情绪氛围营造\n5. 冲突和转折点`;
  const [persona, setPersona] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PERSONA;
    return localStorage.getItem('deconstruct-persona') || DEFAULT_PERSONA;
  });
  const [promptTemplate, setPromptTemplate] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROMPT_TEMPLATE;
    return localStorage.getItem('deconstruct-prompt-template') || DEFAULT_PROMPT_TEMPLATE;
  });
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPrompt[]>([]);
  const [isCommunityPromptsLoading, setIsCommunityPromptsLoading] = useState<boolean>(false);

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

      // 加载社区提示词
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
    fetchInitialData();
  }, [isOpen, bookDetail, bookDetailUrl, sourceId, toast]);
  
  const handleGenerate = async () => {
    if (!selectedChapterUrl) {
      toast({ title: '请选择一个章节', variant: 'destructive' });
      return;
    }

    if (!canGenerate) {
      toast({
        title: '请先配置AI提供商',
        description: '请点击右上角AI设置按钮配置您的AI提供商',
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

        // 2. Build prompt with user customizations
        const prompt = `${promptTemplate}\n\n章节内容：\n${chapterContent.content}`;
        const systemInstruction = persona;

        const result = await aiGenerateContent(prompt, {
          temperature: 0.3, // 低温度保证分析准确性
          maxOutputTokens: maxTokens,
          systemInstruction,
        });
        
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

  // 保存到本地
  const persistPersona = (text: string) => {
    setPersona(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deconstruct-persona', text);
    }
  };
  const persistPromptTemplate = (text: string) => {
    setPromptTemplate(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deconstruct-prompt-template', text);
    }
  };

  const handleCommunityPromptSelect = (promptId: string) => {
    const selected = communityPrompts.find(p => p.id === promptId);
    if (selected) {
      persistPersona(selected.prompt);
      toast({ title: '已应用社区提示词', description: `已套用：${selected.name}` });
    }
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
            <AIProviderSettings variant="ghost" showStatus={true} />
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
                    <Label>AI模型选择</Label>
                    <ModelSelector
                      selectedProviderId={selectedProviderId}
                      selectedModelId={selectedModelId}
                      onProviderChange={setSelectedProvider}
                      onModelChange={setSelectedModel}
                      showLabels={false}
                      showModelInfo={false}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {canGenerate ? (
                        <span className="text-green-600 dark:text-green-400">✓ AI配置已就绪</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">⚠ 请先配置AI提供商</span>
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

            {/* 自定义提示词与社区提示词应用 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="persona">AI 人设 / 系统指令</Label>
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
                  <Button variant="outline" size="sm" onClick={() => persistPersona(DEFAULT_PERSONA)}>重置默认</Button>
                </div>
                <Textarea id="persona" rows={5} value={persona} onChange={(e) => persistPersona(e.target.value)} placeholder="输入或粘贴AI人设/系统提示" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt-template">分析要求（用户提示）</Label>
                <Button variant="outline" size="sm" onClick={() => persistPromptTemplate(DEFAULT_PROMPT_TEMPLATE)}>重置默认</Button>
                <Textarea id="prompt-template" rows={5} value={promptTemplate} onChange={(e) => persistPromptTemplate(e.target.value)} placeholder="输入分析要求，将自动拼接章节内容" />
              </div>
            </div>

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
