
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Edit, Loader2, WandSparkles, Send, Users, Settings, SlidersHorizontal, BookOpen, Type, Maximize2, Minimize2 } from 'lucide-react';
import type { BookstoreBookDetail, BookstoreChapterContent, CommunityPrompt } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { getPrompts } from '@/lib/actions/community';
import { useAI } from '@/hooks/useAI';
import { useAIConfig } from '@/hooks/useAIConfig';
import ModelSelector from './ModelSelector';
import { AIProviderSettings } from './AIProviderSettings';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [streamingOutline, setStreamingOutline] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewMode, setViewMode] = useState<'accordion' | 'raw'>(() => {
    if (typeof window === 'undefined') return 'accordion';
    return (localStorage.getItem('deconstruct-view-mode') as 'accordion' | 'raw') || 'accordion';
  });
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [sizeMode, setSizeMode] = useState<'compact' | 'wide' | 'full'>(() => {
    if (typeof window === 'undefined') return 'compact';
    return (localStorage.getItem('deconstruct-size-mode') as 'compact' | 'wide' | 'full') || 'compact';
  });

  // 使用统一AI配置和调用
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();
  const { generateContent: aiGenerateContent, generateContentStream: aiGenerateContentStream, canGenerate } = useAI();

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

  // 控制配置弹窗的状态
  const [isConfigOpen, setIsConfigOpen] = useState(false);

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
      // 自动弹出配置面板，让用户配置AI
      setIsConfigOpen(true);
      toast({
        title: '请先配置AI提供商',
        description: '已为您打开配置面板，请配置AI提供商和模型',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setIsFetchingChapter(true);
    setOutline('');
    setStreamingOutline('');
    setIsStreaming(false);
    
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

        // 使用流式生成
        setIsStreaming(true);
        let fullResult = '';
        const stream = aiGenerateContentStream(prompt, {
          temperature: 0.3, // 低温度保证分析准确性
          maxOutputTokens: maxTokens,
          systemInstruction,
        });

        for await (const chunk of stream) {
          fullResult += chunk;
          setStreamingOutline(fullResult);
        }
        
        setIsStreaming(false);
        setOutline(fullResult);
        setStreamingOutline(''); // 清理流式状态
        
        // 生成后默认全部折叠（只展开第一项）
        setTimeout(() => {
          setOpenSections(['section-0']);
        }, 0);
        
    } catch(err: any) {
        toast({ title: '生成细纲失败', description: err.message, variant: 'destructive' });
        setIsFetchingChapter(false);
    } finally {
        setIsGenerating(false);
        setIsStreaming(false);
    }
  }

  // 将大段文本的细纲解析为多个小节，支持标题/编号识别
  const sections = useMemo(() => {
    if (!outline) return [] as { title: string; content: string; id: string }[];
    const lines = outline.split(/\r?\n/);
    const results: { title: string; content: string; id: string }[] = [];
    let currentTitle: string | null = null;
    let currentContent: string[] = [];

    const isHeading = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^#{1,6}\s+/.test(trimmed)) return true; // Markdown 标题
      if (/^(?:第?[一二三四五六七八九十百千]+[章节部篇节]|[0-9]{1,2}[\.|、\)]).+/.test(trimmed)) return true; // 编号标题
      if (/^\*\*.+\*\*$/.test(trimmed)) return true; // 粗体标题
      return false;
    };

    const flush = () => {
      if (currentTitle !== null) {
        const id = `section-${results.length}`;
        results.push({ title: currentTitle, content: currentContent.join('\n').trim(), id });
      }
      currentTitle = null;
      currentContent = [];
    };

    for (const line of lines) {
      if (isHeading(line)) {
        flush();
        currentTitle = line.replace(/^#{1,6}\s+/, '').replace(/^\*\*(.+)\*\*$/, '$1').trim();
        continue;
      }
      if (currentTitle === null && line.trim()) {
        // 如果开头没有明显标题，创建一个默认标题
        currentTitle = '概要';
      }
      currentContent.push(line);
    }
    flush();

    // 过滤空章节
    return results.filter(s => s.content);
  }, [outline]);

  const switchViewMode = (mode: 'accordion' | 'raw') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deconstruct-view-mode', mode);
    }
  };

  const switchSizeMode = (mode: 'compact' | 'wide' | 'full') => {
    setSizeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deconstruct-size-mode', mode);
    }
  };

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
      <DialogContent className={`max-w-2xl ${sizeMode === 'wide' ? 'w-full' : sizeMode === 'full' ? 'w-full h-full' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <WandSparkles/> 拆解细纲
            </div>
            {/* 顶部工具栏以及详细设置弹窗 */}
            <TooltipProvider>
              <div className="flex items-center gap-2 justify-end mb-2">
                <Popover open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <SlidersHorizontal className="w-5 h-5" />
                      {!canGenerate && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-96 max-h-[80vh] overflow-y-auto" 
                    side="left" 
                    align="start"
                    sideOffset={10}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">AI配置与提示词设置</h4>
                        {!canGenerate && (
                          <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">需要配置</span>
                        )}
                      </div>
                      
                      {/* 详细设置：模型选择/Token长度/AI人设/分析要求/社区提示词 */}
                      <div className="space-y-3">
                        <Label>AI模型选择</Label>
                        <ModelSelector selectedProviderId={selectedProviderId} selectedModelId={selectedModelId} onProviderChange={setSelectedProvider} onModelChange={setSelectedModel} showLabels={false} showModelInfo={true}/>
                      </div>
                      <div>
                        <Label htmlFor='max-tokens-select'>最大输出长度</Label>
                        <Select value={String(maxTokens)} onValueChange={(v) => { const n = parseInt(v, 10); setMaxTokens(n); if (typeof window !== 'undefined') localStorage.setItem('deconstruct-max-tokens', String(n));}}>
                          <SelectTrigger id='max-tokens-select'><SelectValue placeholder="选择最大输出长度" /></SelectTrigger>
                          <SelectContent>{[512,1024,1536,2048,3072,4096,6144,8192,16000,30000].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">超长章节建议搭配较大值；若提示 MAX_TOKENS，可适当增大或分段分析。</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="persona">AI人设 / 系统指令</Label>
                        <div className="flex items-center gap-2">
                          <Select onValueChange={handleCommunityPromptSelect} disabled={isCommunityPromptsLoading}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder={<div className='flex items-center gap-2'><Users className="h-4 w-4"/>社区提示词</div>} />
                            </SelectTrigger>
                            <SelectContent>
                              {isCommunityPromptsLoading ? <SelectItem value="loading" disabled>加载中...</SelectItem> : communityPrompts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => persistPersona(DEFAULT_PERSONA)}>重置默认</Button>
                        </div>
                        <Textarea id="persona" rows={3} value={persona} onChange={(e) => persistPersona(e.target.value)} placeholder="输入AI人设/系统提示" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prompt-template">分析要求（用户提示）</Label>
                        <Button variant="outline" size="sm" onClick={() => persistPromptTemplate(DEFAULT_PROMPT_TEMPLATE)}>重置默认</Button>
                        <Textarea id="prompt-template" rows={3} value={promptTemplate} onChange={(e) => persistPromptTemplate(e.target.value)} placeholder="输入分析要求，将自动拼接章节内容" />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><AIProviderSettings variant="ghost" showStatus={true} /></span>
                  </TooltipTrigger>
                  <TooltipContent>AI账号配置</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={()=>switchSizeMode(sizeMode==='compact'?'wide':sizeMode==='wide'?'full':'compact')}>
                      {sizeMode==='compact'?<Maximize2 className="w-5 h-5" />:sizeMode==='wide'?<Type className="w-5 h-5" />:<Minimize2 className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>窗口尺寸切换</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription>
            选择一个章节，AI将为你提炼核心剧情脉络。
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {/* 章节选择区（紧凑回归） */}
            <div className="mb-2">
              {isFetchingBook ? (
                <div className="flex items-center justify-center h-16"><Loader2 className="animate-spin mr-2"/> 正在获取书籍信息...</div>
              ) : bookDetail ? (
                <div>
                  <Label htmlFor='chapter-select'>选择章节</Label>
                  <Select onValueChange={setSelectedChapterUrl} value={selectedChapterUrl}>
                    <SelectTrigger id="chapter-select">
                      <SelectValue placeholder="选择章节进行拆解" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {bookDetail.chapters.map((chapter, index) => (
                        <SelectItem key={chapter.url+index} value={chapter.url}>{chapter.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : <p>无法加载书籍详情。</p>}
            </div>

            { (isFetchingChapter || isGenerating) && (
                 <div className="flex items-center justify-center h-24">
                    <Loader2 className="animate-spin mr-2"/> 
                    {isFetchingChapter ? '正在获取章节内容...' : isStreaming ? 'AI正在生成细纲...' : '正在处理...'}
                </div>
            )}

            {/* 流式输出显示 */}
            {isStreaming && streamingOutline && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  实时生成进度
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                </Label>
                <div className="max-h-64 rounded-md border p-4 bg-muted/30">
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {streamingOutline}
                    <span className="animate-pulse">▋</span>
                  </div>
                </div>
              </div>
            )}
            
            {outline && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>生成结果</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={viewMode === 'accordion' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => switchViewMode('accordion')}
                        >
                          折叠视图
                        </Button>
                        <Button
                          variant={viewMode === 'raw' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => switchViewMode('raw')}
                        >
                          原文视图
                        </Button>
                        {viewMode === 'accordion' && sections.length > 0 && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setOpenSections(sections.map(s => s.id))}
                            >
                              全部展开
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setOpenSections([])}
                            >
                              全部折叠
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {viewMode === 'accordion' && sections.length > 0 ? (
                      <div className="max-h-96 rounded-md border p-2">
                        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
                          {sections.map((s) => (
                            <AccordionItem key={s.id} value={s.id}>
                              <AccordionTrigger className="text-left">
                                <span className="text-sm font-medium">{s.title}</span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="text-sm text-foreground/80 whitespace-pre-wrap px-2">
                                  {s.content}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    ) : (
                      <ScrollArea className="h-64 w-full rounded-md border p-4">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{outline}</p>
                      </ScrollArea>
                    )}
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
            <Button onClick={handleGenerate} disabled={!selectedChapterUrl || isGenerating} className="relative">
                {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <WandSparkles className="mr-2"/>}
                开始生成
                {!canGenerate && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
