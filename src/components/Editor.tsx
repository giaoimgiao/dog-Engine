'use client';

import type { Chapter, Book, WorldSetting, Character, CommunityPrompt } from '@/lib/types';
import { getPrompts } from '@/lib/actions/community';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Bot, Sparkles, Loader2, Settings2, Users, BookOpen, BrainCircuit, ScanLine, Shuffle, SpellCheck2, ChevronRight, ClipboardCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from './ui/checkbox';
import AiDetector from './AiDetector';
import { AIProviderSettings } from './AIProviderSettings';
import ModelSelector from './ModelSelector';
import { useAI } from '@/hooks/useAI';
import { useAIConfig } from '@/hooks/useAIConfig';
import { useRouter } from 'next/navigation';


interface EditorProps {
  chapter: Chapter;
  updateChapterContent: (chapterId: string, content: string) => void;
  fullContext: {
    book: Book;
    worldSettings: WorldSetting[];
    characters: Character[];
  };
  aiRole: string;
  setAiRole: (role: string) => void;
  aiRoleDisplay: string;
  setAiRoleDisplay: (display: string) => void;
}

const DECONSTRUCT_OUTLINE_KEY = 'deconstruct-outline-result';

export default function Editor({ 
    chapter, 
    updateChapterContent, 
    fullContext,
    aiRole,
    setAiRole,
    aiRoleDisplay,
    setAiRoleDisplay,
}: EditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(chapter.content);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  
  const [communityPrompts, setCommunityPrompts] = useState<CommunityPrompt[]>([]);
  const [isCommunityPromptsLoading, setIsCommunityPromptsLoading] = useState(true);

  // 使用统一AI配置和调用
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();
  const { generateContent: aiGenerateContent, generateContentStream: aiGenerateContentStream, canGenerate } = useAI();
  
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  
  const [includeThoughts, setIncludeThoughts] = useState(true);
  const [thinkingBudget, setThinkingBudget] = useState([-1]);


  const [contextChapterIds, setContextChapterIds] = useState<Set<string>>(new Set());
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedContext, setCompressedContext] = useState<string>('');
  const [useCompressedContext, setUseCompressedContext] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem('context-compress-use');
    return v === null ? true : v === '1';
  });
  const DEFAULT_COMPRESS_PERSONA = `你是资深网文剧情分析师，擅长从大量文本中提取剧情主线与关键事件。`;
  const DEFAULT_COMPRESS_PROMPT = `请将以下多章节内容压缩为「剧情重点事件清单」，要求：\n- 仅保留推动主线的关键事件与设定\n- 列表化输出，每条尽量不超过两句\n- 标注出涉及的主要角色与地点\n- 去除细节描写与重复信息\n- 若信息不完整，用(?)标记`;
  const [compressPersona, setCompressPersona] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_COMPRESS_PERSONA;
    return localStorage.getItem('context-compress-persona') || DEFAULT_COMPRESS_PERSONA;
  });
  const [compressPrompt, setCompressPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_COMPRESS_PROMPT;
    return localStorage.getItem('context-compress-prompt') || DEFAULT_COMPRESS_PROMPT;
  });
  // 压缩模型使用当前选中的模型
  const compressModel = selectedModelId;
  const [compressMaxTokens, setCompressMaxTokens] = useState<number>(() => {
    if (typeof window === 'undefined') return 2048;
    const saved = localStorage.getItem('context-compress-max-tokens');
    const n = saved ? parseInt(saved, 10) : 2048;
    return Number.isFinite(n) && n >= 512 ? n : 2048;
  });
  
  const otherChapters = useMemo(() => {
    return fullContext.book.chapters.filter(c => c.id !== chapter.id);
  }, [fullContext.book.chapters, chapter.id]);
  const nonSpaceLength = (text: string) => (text || '').replace(/\s+/g, '').length;
  const currentCount = useMemo(() => nonSpaceLength(content), [content]);
  const selectedContextChars = useMemo(() => {
    return otherChapters
      .filter(c => contextChapterIds.has(c.id))
      .reduce((sum, c) => sum + nonSpaceLength(c.content), 0);
  }, [otherChapters, contextChapterIds]);
  const reachCompressThreshold = selectedContextChars >= 100000; // 10万字

  // Floating action bar visibility when near bottom of page
  const [showFab, setShowFab] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const rootEl = scrollRootRef.current;
    if (!rootEl) return;
    const viewport = rootEl.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport || !bottomSentinelRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        setShowFab(entry.isIntersecting && entry.intersectionRatio >= 1);
      },
      { root: viewport, threshold: 1 }
    );
    observer.observe(bottomSentinelRef.current);
    return () => observer.disconnect();
  }, [scrollRootRef.current]);

  // 剧情抽卡（续写下一章）
  const [isPlotDialogOpen, setIsPlotDialogOpen] = useState(false);
  const DEFAULT_PLOT_PERSONA = `你是一个擅长爽点设计与反转的网文作者，精于承接前文并自然引出下一章的冲突与悬念。请基于上文续写"下一章"的首稿，要求：\n- 保持已有设定与角色性格一致\n- 设计清晰的段落推进（起→承→转→合）\n- 至少给出1个强悬念或爆点（以结尾埋钩）\n- 语言保持网文节奏，短句为主，镜头感强`;
  const [plotPersona, setPlotPersona] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PLOT_PERSONA;
    return localStorage.getItem('plot-persona') || DEFAULT_PLOT_PERSONA;
  });
  const [plotDissatisfaction, setPlotDissatisfaction] = useState<string>('');
  const [plotResult, setPlotResult] = useState<string>('');
  const [isPlotGenerating, setIsPlotGenerating] = useState(false);

  const handleCommunityPromptSelectForPlot = (promptId: string) => {
    const selected = communityPrompts.find(p => p.id === promptId);
    if (selected) {
      setPlotPersona(selected.prompt);
      if (typeof window !== 'undefined') localStorage.setItem('plot-persona', selected.prompt);
      toast({ title: '已应用社区提示词', description: `已套用：${selected.name}` });
    }
  };

  const handlePlotGenerate = async () => {
    if (!canGenerate) {
      toast({ title: '请先配置AI提供商', description: '点击右上角 AI 设置进行配置', variant: 'destructive' });
      return;
    }
    setIsPlotGenerating(true);
    try {
      const characterContext = fullContext.characters
        .filter(c => c.enabled)
        .map(c => `角色名: ${c.name}\n设定: ${c.description}`)
        .join('\n\n');
      const worldBookContext = fullContext.worldSettings
        .filter(ws => ws.enabled)
        .map(ws => `关键词: ${ws.keyword}\n设定: ${ws.description}`)
        .join('\n\n');
      // 取前2章作为参考
      const chapters = fullContext.book.chapters;
      const currentIndex = chapters.findIndex(c => c.id === chapter.id);
      const prevTwo = chapters.slice(Math.max(0, currentIndex - 2), currentIndex)
        .map(c => `【${c.title}】\n${c.content}`)
        .join('\n\n');
      const context = `=== 上文摘取 ===\n${prevTwo}\n\n=== 当前章节 ===\n${content}`;

      const systemInstruction = `${plotPersona}\n${characterContext ? `\n=== 角色设定 ===\n${characterContext}` : ''}${worldBookContext ? `\n\n=== 世界设定 ===\n${worldBookContext}` : ''}`;
      const dissatisfaction = plotDissatisfaction.trim() ? `\n\n【上次不满意点】${plotDissatisfaction.trim()}` : '';
      const finalPrompt = `${dissatisfaction}${context}`;
      const result = await aiGenerateContent(finalPrompt, {
        temperature: 0.7,
        maxOutputTokens: Math.max(2048, maxTokens[0]),
        systemInstruction
      });
      setPlotResult(result);
      setPlotDissatisfaction(''); // 清空不满意输入，等用户填写新的
    } catch (e: any) {
      toast({ title: '生成失败', description: e.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setIsPlotGenerating(false);
    }
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: '已复制到剪贴板' }); } catch { /* ignore */ }
  };

  // 错字检查 Agent - 流式修改
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [proofOriginal, setProofOriginal] = useState('');
  const [isProofing, setIsProofing] = useState(false);
  const [isProofResultOpen, setIsProofResultOpen] = useState(false);
  const [proofDiffHtml, setProofDiffHtml] = useState('');

  function buildDiffHtml(original: string, corrected: string): string {
    const oLines = (original || '').split('\n');
    const cLines = (corrected || '').split('\n');
    const maxLines = Math.max(oLines.length, cLines.length);
    const resultLines: string[] = [];

    function normalizeChar(ch: string): string {
      // 将全角空格等统一为半角空格，只用于比较
      if (ch === '　') return ' ';
      return ch;
    }

    function highlightLineDiff(o: string, c: string): string {
      if (o === c) return escapeHtml(c);
      const a = Array.from(o || '');
      const b = Array.from(c || '');
      const m = a.length, n = b.length;
      const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          if (normalizeChar(a[i]) === normalizeChar(b[j])) dp[i + 1][j + 1] = dp[i][j] + 1; else dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      // 反向还原，构建以 b 为主的输出，新增/删除/替换高亮
      let i = m, j = n;
      const out: { t: 'same' | 'add' | 'del'; ch: string }[] = [];
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && normalizeChar(a[i - 1]) === normalizeChar(b[j - 1])) {
          out.push({ t: 'same', ch: b[j - 1] }); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          out.push({ t: 'add', ch: b[j - 1] }); j--;
        } else if (i > 0) {
          // 删除 a[i-1]
          out.push({ t: 'del', ch: a[i - 1] }); i--;
        }
      }
      out.reverse();
      let res = '';
      let buf = '';
      let mode: 'same' | 'add' | 'del' | null = null;
      const flush = () => {
        if (buf.length === 0) return;
        if (mode === 'add') {
          res += `<span class=\"bg-red-100 dark:bg-red-900\/30 text-red-600 dark:text-red-400 font-medium\">${escapeHtml(buf)}</span>`;
        } else if (mode === 'del') {
          res += `<span class=\"line-through text-red-600 dark:text-red-400 opacity-80\">${escapeHtml(buf)}</span>`;
        } else {
          res += escapeHtml(buf);
        }
        buf = '';
      };
      for (const seg of out) {
        if (mode === null) { mode = seg.t as 'same' | 'add' | 'del'; buf = seg.ch; continue; }
        if (seg.t === mode) { buf += seg.ch; } else { flush(); mode = seg.t as 'same' | 'add' | 'del'; buf = seg.ch; }
      }
      flush();
      return res;
    }

    function escapeHtml(s: string): string {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    for (let i = 0; i < maxLines; i++) {
      const o = oLines[i] ?? '';
      const c = cLines[i] ?? '';
      if (i >= oLines.length) {
        // 新增整行
        resultLines.push(`<span class=\"bg-red-100 dark:bg-red-900\/30 text-red-600 dark:text-red-400 font-medium\">${escapeHtml(c)}</span>`);
        continue;
      }
      if (i >= cLines.length) {
        // 删除整行
        resultLines.push(`<span class=\"line-through text-red-600 dark:text-red-400 opacity-80\">${escapeHtml(o)}</span>`);
        continue;
      }
      resultLines.push(highlightLineDiff(o, c));
    }

    return resultLines.join('\n');
  }
  
  const handleProof = async () => {
    if (!canGenerate) {
      toast({ title: '请先配置AI提供商', description: '点击右上角 AI 设置进行配置', variant: 'destructive' });
      return;
    }
    
    setIsProofing(true);
    setProofOriginal(content);
    setIsProofDialogOpen(false); // 关闭对话框，让用户看到编辑器
    
    try {
      const sys = `你是专业的中文校对助手。请逐行检查并修正文本中的错别字、标点错误、语序问题、重复词句。

**重要要求：**
1. 直接输出修正后的完整文本，不要添加任何解释或JSON格式
2. 保持原文的分段和格式
3. 只修正明显的错误，不改变原文风格和表达
4. 如果某段没有错误，原样输出`;
      
      let correctedText = '';
      const stream = aiGenerateContentStream(
        `待校对文本：\n${content}`,
        { temperature: 0.2, maxOutputTokens: 8192, systemInstruction: sys }
      );
      
      // 逐块接收并更新到编辑器
      for await (const chunk of stream) {
        correctedText += chunk;
        // 实时更新编辑器内容，实现"逐行修改"效果
        setContent(correctedText);
        updateChapterContent(chapter.id, correctedText);
        // 添加延迟以模拟打字机效果（可选）
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // 计算高亮差异并展示
      try {
        const html = buildDiffHtml(proofOriginal, correctedText);
        setProofDiffHtml(html);
        setIsProofResultOpen(true);
      } catch {
        // ignore diff errors
      }

      toast({ title: '校对完成', description: '已完成智能校对，如不满意可使用 Ctrl+Z 撤销', duration: 4000 });
    } catch (e: any) {
      console.error('Proof error:', e);
      // 恢复原文
      setContent(proofOriginal);
      updateChapterContent(chapter.id, proofOriginal);
      toast({ title: '校对失败', description: e.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setIsProofing(false);
    }
  };
  
  const revertProofCorrection = () => {
    if (proofOriginal) {
      setContent(proofOriginal);
      updateChapterContent(chapter.id, proofOriginal);
      setProofOriginal('');
      toast({ title: '已撤回修正', description: '恢复到校对前的内容' });
    }
  };
  
  // Sync editor content with the active chapter prop
  useEffect(() => {
    setContent(chapter.content);
  }, [chapter]);


  useEffect(() => {
    const outline = localStorage.getItem(DECONSTRUCT_OUTLINE_KEY);
    if (outline) {
      setPrompt(outline);
      localStorage.removeItem(DECONSTRUCT_OUTLINE_KEY);
      setIsAiDialogOpen(true); // Open the dialog automatically
      toast({
        title: '细纲已应用',
        description: '从书城拆解的细纲已自动填充到指令框中。'
      })
    }
  }, []);


  useEffect(() => {
    async function fetchInitialData() {
      // 加载社区提示
      try {
        setIsCommunityPromptsLoading(true);
        const prompts = await getPrompts();
        setCommunityPrompts(prompts);
      } catch (error) {
         console.error("Failed to fetch community prompts:", error);
         toast({
            title: '社区设定加载失败',
            description: '无法加载社区分享的角色设定。',
            variant: 'destructive',
        });
      } finally {
        setIsCommunityPromptsLoading(false);
      }
    }
    fetchInitialData();
  }, [toast]);


  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    updateChapterContent(chapter.id, e.target.value);
  };
  
  const handleCommunityPromptSelect = (promptId: string) => {
    const selected = communityPrompts.find(p => p.id === promptId);
    if (selected) {
        setAiRole(selected.prompt);
        setAiRoleDisplay(selected.name); // Show name in input
    }
  }

  const handleAiRoleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAiRoleDisplay(e.target.value); // Update display value
    setAiRole(e.target.value); // Also update the actual role value
  }
  
  const handleContextChapterToggle = (chapterId: string) => {
    setContextChapterIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(chapterId)) {
            newSet.delete(chapterId);
        } else {
            newSet.add(chapterId);
        }
        return newSet;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: '提示不能为空',
        description: '请输入一些内容来引导AI。',
        variant: 'destructive',
      });
      return;
    }

    // 检查AI配置
    if (!canGenerate) {
      toast({
        title: '请先配置AI提供商',
        description: '请点击右上角AI设置按钮配置您的AI提供商',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    setIsAiDialogOpen(false);
    try {
      
      const characterContext = fullContext.characters
        .filter(c => c.enabled)
        .map(c => `角色名: ${c.name}\n设定: ${c.description}`)
        .join('\n\n');

      const worldBookContext = fullContext.worldSettings
        .filter(ws => ws.enabled && content.includes(ws.keyword))
        .map(ws => `关键词: ${ws.keyword}\n设定: ${ws.description}`)
        .join('\n\n');
      
      const rawContext = fullContext.book.chapters
        .filter(c => contextChapterIds.has(c.id))
        .map(c => `--- Begin Chapter: ${c.title} ---\n${c.content}\n--- End Chapter: ${c.title} ---`)
        .join('\n\n');

      const otherChaptersContext = (compressedContext && useCompressedContext)
        ? `【压缩剧情要点】\n${compressedContext}`
        : rawContext;

      const fullChapterContext = `${content}\n\n${otherChaptersContext}`;

      // 构建系统指令
      const systemInstruction = `你是一个专业的网络小说写作助手。

${aiRole ? `你的角色设定：${aiRole}\n` : ''}
${characterContext ? `\n=== 角色设定 ===\n${characterContext}\n` : ''}
${worldBookContext ? `\n=== 世界设定 ===\n${worldBookContext}\n` : ''}
${fullChapterContext ? `\n=== 当前章节内容 ===\n${fullChapterContext}\n` : ''}

请根据用户的指令和以上上下文信息进行创作。`;

      // 使用统一AI客户端
      const result = await aiGenerateContent(prompt, {
        temperature: temperature[0],
        maxOutputTokens: maxTokens[0],
        systemInstruction,
      });
      
      setContent(result);
      updateChapterContent(chapter.id, result);
      setPrompt('');

    } catch (error: any) {
      console.error('AI generation failed:', error);
      toast({
        title: '生成失败',
        description: error.message || 'AI生成内容时出现错误，请稍后再试。',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const budgetValue = thinkingBudget[0];
  const budgetLabel = budgetValue === -1 ? '动态' : budgetValue === 0 ? '关闭' : budgetValue;

  const handleCompress = async () => {
    if (isCompressing) return;
    if (!canGenerate) {
      toast({ title: '请先配置AI提供商', description: '点击右上角 AI 设置进行配置', variant: 'destructive' });
      return;
    }
    const contextToCompress = otherChapters
      .filter(c => contextChapterIds.has(c.id))
      .map(c => `【${c.title}】\n${c.content}`)
      .join('\n\n');
    if (!contextToCompress.trim()) {
      toast({ title: '请选择上下文章节', variant: 'destructive' });
      return;
    }
    setIsCompressing(true);
    try {
      const prompt = `${compressPrompt}\n\n=== 原文多章节内容 ===\n${contextToCompress}`;
      const summary = await aiGenerateContent(prompt, {
        temperature: 0.2,
        maxOutputTokens: compressMaxTokens,
        systemInstruction: compressPersona,
      });
      setCompressedContext(summary);
      setUseCompressedContext(true);
      if (typeof window !== 'undefined') localStorage.setItem('context-compress-use', '1');
      toast({ title: '压缩完成', description: '已生成剧情要点，将在生成时优先使用。' });
    } catch (e: any) {
      toast({ title: '压缩失败', description: e.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setIsCompressing(false);
    }
  };


  return (
    <div className="flex flex-col h-full bg-background relative">
        <div className="px-3 py-2 sm:p-4 border-b flex justify-between items-center">
            <h2 className="text-lg sm:text-2xl font-bold font-headline">{chapter.title}</h2>
            <div className='flex items-center gap-1 sm:gap-2'>
                <div className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">字数：<span className="font-medium">{currentCount}</span></div>
                <AIProviderSettings showStatus={true} />
                <AiDetector text={content} />
            </div>
        </div>
        <ScrollArea className="flex-grow" ref={scrollRootRef as any}>
            <Textarea
                value={content}
                onChange={handleContentChange}
                placeholder="在这里开始你的故事..."
                className="w-full h-full text-base resize-none border-0 focus:ring-0 focus-visible:ring-0 p-4 sm:p-6 bg-transparent"
                style={{minHeight: 'calc(100vh - 160px)'}}
            />
            <div ref={bottomSentinelRef} className="h-1" />
        </ScrollArea>
        
        {/* 底部浮出操作条（接近页面底部时显示） */}
        {showFab && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-md border rounded-full px-2 py-1 shadow-md">
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setIsPlotDialogOpen(true)}>
              <Shuffle className="h-4 w-4 mr-1" /> 剧情抽卡
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setIsProofDialogOpen(true)}>
              <SpellCheck2 className="h-4 w-4 mr-1" /> 检查错字
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => router.push('/review')}>
              <ChevronRight className="h-4 w-4 mr-1" /> 跳转审稿
            </Button>
          </div>
        )}

        {/* 剧情抽卡 Dialog */}
        <Dialog open={isPlotDialogOpen} onOpenChange={(open) => { setIsPlotDialogOpen(open); if (!open) { setPlotResult(''); setPlotDissatisfaction(''); } }}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Shuffle /> 剧情抽卡（续写下一章）</DialogTitle>
              <DialogDescription>根据上文、角色卡与世界书信息续写下一章。</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-2">
                {!plotResult ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>AI 人设</Label>
                        <div className="flex gap-2">
                          <Select onValueChange={handleCommunityPromptSelectForPlot} disabled={isCommunityPromptsLoading}>
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue placeholder={<div className='flex items-center gap-1'><Users className="h-3 w-3"/><span className="text-xs">社区提示词</span></div>} />
                            </SelectTrigger>
                            <SelectContent>
                              {isCommunityPromptsLoading ? (
                                <SelectItem value="loading" disabled>加载中...</SelectItem>
                              ) : (
                                communityPrompts.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))
                              )}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => { setPlotPersona(DEFAULT_PLOT_PERSONA); if (typeof window !== 'undefined') localStorage.setItem('plot-persona', DEFAULT_PLOT_PERSONA); }}>重置</Button>
                        </div>
                      </div>
                      <Textarea rows={6} value={plotPersona} onChange={(e) => { setPlotPersona(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('plot-persona', e.target.value); }} placeholder="输入续写提示词" />
                    </div>
                    <div className="space-y-4">
                      <ModelSelector
                        selectedProviderId={selectedProviderId}
                        selectedModelId={selectedModelId}
                        onProviderChange={setSelectedProvider}
                        onModelChange={setSelectedModel}
                        compact={true}
                        showLabels={false}
                      />
                      <div className="space-y-2">
                        <Label>最大输出</Label>
                        <Select value={String(maxTokens[0])} onValueChange={(v) => setMaxTokens([parseInt(v, 10)])}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择最大输出" />
                          </SelectTrigger>
                          <SelectContent>
                            {[2048, 3072, 4096, 6144, 8192].map(n => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>续写结果</Label>
                      <ScrollArea className="h-48 w-full rounded-md border p-3">
                        <p className="text-sm whitespace-pre-wrap">{plotResult}</p>
                      </ScrollArea>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyText(plotResult)}><ClipboardCopy className="h-4 w-4 mr-1"/>复制</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>这段剧情有什么不满意的地方？（可选）</Label>
                      <Textarea rows={3} value={plotDissatisfaction} onChange={(e) => setPlotDissatisfaction(e.target.value)} placeholder="例如：冲突弱、推进慢、缺少反转、主角动机单薄……" />
                      <p className="text-xs text-muted-foreground">填写后点击"重新抽卡"将根据不满意点重新生成</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              {!plotResult ? (
                <Button onClick={handlePlotGenerate} disabled={isPlotGenerating}>
                  {isPlotGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
                  生成
                </Button>
              ) : (
                <Button onClick={handlePlotGenerate} disabled={isPlotGenerating}>
                  {isPlotGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
                  重新抽卡
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 校对结果对比 Dialog */}
        <Dialog open={isProofResultOpen} onOpenChange={setIsProofResultOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><SpellCheck2 /> 修改对比</DialogTitle>
              <DialogDescription>红色为AI改动的文字（逐行比较）</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="rounded-md border p-4 bg-muted/30">
                <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: proofDiffHtml }} />
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button>关闭</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* 错字检查 Agent Dialog */}
        <Dialog open={isProofDialogOpen} onOpenChange={(open) => { setIsProofDialogOpen(open); if (!open && !isProofing) { setProofOriginal(''); } }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><SpellCheck2 /> AI 智能校对</DialogTitle>
              <DialogDescription>选择模型后开始校对，AI 将在编辑器中逐行流式修改文本</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>校对模型</Label>
                <ModelSelector
                  selectedProviderId={selectedProviderId}
                  selectedModelId={selectedModelId}
                  onProviderChange={setSelectedProvider}
                  onModelChange={setSelectedModel}
                  compact={true}
                  showLabels={false}
                />
                <p className="text-xs text-muted-foreground">
                  使用当前选中的AI模型进行校对
                </p>
              </div>
              
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="flex items-start gap-2">
                  <SpellCheck2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">流式修改模式</p>
                    <p className="text-muted-foreground text-xs">• AI 将直接在编辑器中逐行修改文本</p>
                    <p className="text-muted-foreground text-xs">• 实时看到修改过程，就像打字一样</p>
                    <p className="text-muted-foreground text-xs">• 不满意可用 Ctrl+Z 撤销或点击"撤回"按钮</p>
                  </div>
                </div>
              </div>
              
              {proofOriginal && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={revertProofCorrection} className="flex-1">
                    撤回到校对前
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" disabled={isProofing}>取消</Button>
              </DialogClose>
              <Button onClick={handleProof} disabled={isProofing}>
                {isProofing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SpellCheck2 className="mr-2 h-4 w-4" />}
                {isProofing ? '校对中...' : '开始校对'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
            <DialogTrigger asChild>
                 <Button className="absolute bottom-6 right-6 rounded-full h-12 w-12 shadow-lg">
                    <Sparkles className="h-6 w-6" />
                 </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-headline text-lg"><Bot /> AI 写作助手</DialogTitle>
                    <DialogDescription>
                        配置 AI 的行为，然后让它帮你继续创作。
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="ai-role">AI 角色设定</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="ai-role" 
                                    value={aiRoleDisplay} 
                                    onChange={handleAiRoleInputChange}
                                    placeholder="例如：一个愤世嫉俗的侦探"
                                    className="flex-grow"
                                />
                                <Select onValueChange={handleCommunityPromptSelect} disabled={isCommunityPromptsLoading}>
                                    <SelectTrigger className="w-[130px] flex-shrink-0">
                                        <SelectValue placeholder={
                                            <div className='flex items-center gap-2'>
                                                <Users className="h-4 w-4"/>
                                                <span>社区设定</span>
                                            </div>
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isCommunityPromptsLoading ? (
                                            <SelectItem value="loading" disabled>加载中...</SelectItem>
                                        ) : (
                                            communityPrompts.map(prompt => (
                                                <SelectItem key={prompt.id} value={prompt.id}>{prompt.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ai-prompt">你的指令</Label>
                            <Textarea 
                                id="ai-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="接下来会发生什么？"
                                rows={4}
                            />
                        </div>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="context-chapters">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" />
                                        上下文章节 ({contextChapterIds.size})
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2">
                                    <ScrollArea className="h-40 w-full rounded-md border p-2">
                                        <div className="space-y-2">
                                        {otherChapters.length > 0 ? otherChapters.map(chap => (
                                            <div key={chap.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`context-${chap.id}`}
                                                    checked={contextChapterIds.has(chap.id)}
                                                    onCheckedChange={() => handleContextChapterToggle(chap.id)}
                                                />
                                                <label
                                                    htmlFor={`context-${chap.id}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {chap.title}
                                                </label>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-muted-foreground text-center p-4">没有其他章节可供选择。</p>
                                        )}
                                        </div>
                                    </ScrollArea>
                                    <div className="mt-3 space-y-2">
                                        <div className="text-xs text-muted-foreground">
                                            已选择上下文字数（不含空格）：<span className="font-medium">{selectedContextChars}</span>
                                        </div>
                                        {reachCompressThreshold && (
                                            <div className="rounded-md border p-3 space-y-2">
                                                <div className="text-sm font-medium">AI 剧情压缩</div>
                                                <div className="text-xs text-muted-foreground">选择章节达到10万字时，可以先压缩为剧情要点，生成时优先使用。</div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>压缩使用模型</Label>
                                                        <div className="text-sm text-muted-foreground">
                                                            使用当前选中的模型: {selectedModelId || '未选择'}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>压缩最大输出</Label>
                                                        <Select value={String(compressMaxTokens)} onValueChange={(v) => {
                                                            const n = parseInt(v, 10);
                                                            setCompressMaxTokens(n);
                                                            if (typeof window !== 'undefined') localStorage.setItem('context-compress-max-tokens', String(n));
                                                        }}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="选择最大输出长度" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {[1024, 1536, 2048, 3072, 4096].map(n => (
                                                                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>压缩人设</Label>
                                                        <Textarea rows={3} value={compressPersona} onChange={(e) => {
                                                            setCompressPersona(e.target.value);
                                                            if (typeof window !== 'undefined') localStorage.setItem('context-compress-persona', e.target.value);
                                                        }} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>压缩提示</Label>
                                                        <Textarea rows={3} value={compressPrompt} onChange={(e) => {
                                                            setCompressPrompt(e.target.value);
                                                            if (typeof window !== 'undefined') localStorage.setItem('context-compress-prompt', e.target.value);
                                                        }} />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-muted-foreground">生成时优先使用压缩结果</div>
                                                    <Switch checked={useCompressedContext} onCheckedChange={(v) => {
                                                        setUseCompressedContext(!!v);
                                                        if (typeof window !== 'undefined') localStorage.setItem('context-compress-use', v ? '1' : '0');
                                                    }} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => setCompressedContext('')} disabled={isCompressing}>清空压缩结果</Button>
                                                    <Button size="sm" onClick={handleCompress} disabled={isCompressing}>
                                                        {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                        生成压缩要点
                                                    </Button>
                                                </div>
                                                {compressedContext && (
                                                    <div className="pt-2">
                                                        <Label>压缩结果预览</Label>
                                                        <ScrollArea className="h-32 w-full rounded-md border p-2">
                                                            <p className="text-xs whitespace-pre-wrap text-foreground/80">{compressedContext}</p>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="h-4 w-4" />
                                        高级设置
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 space-y-6">
                                    <div className="grid gap-2">
                                        <Label>AI模型选择</Label>
                                        <ModelSelector
                                            selectedProviderId={selectedProviderId}
                                            selectedModelId={selectedModelId}
                                            onProviderChange={setSelectedProvider}
                                            onModelChange={setSelectedModel}
                                            showLabels={false}
                                            showModelInfo={false}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {canGenerate ? (
                                                <span className="text-green-600 dark:text-green-400">✓ AI配置已就绪</span>
                                            ) : (
                                                <span className="text-amber-600 dark:text-amber-400">⚠ 请先配置AI提供商</span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>温度 (Temperature): {temperature[0].toFixed(2)}</Label>
                                        <Slider
                                            value={temperature}
                                            onValueChange={setTemperature}
                                            max={1}
                                            step={0.05}
                                        />
                                        <p className="text-xs text-muted-foreground">值越低，结果越确定；值越高，结果越有创意。</p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>最长输出: {maxTokens[0]} tokens</Label>
                                        <Slider
                                            value={maxTokens}
                                            onValueChange={setMaxTokens}
                                            max={8192}
                                            step={128}
                                            min={256}
                                        />
                                        <p className="text-xs text-muted-foreground">控制单次生成内容的最大长度。</p>
                                    </div>

                                    <div className="space-y-4 rounded-md border p-4">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="include-thoughts" className="flex items-center gap-2">
                                                <BrainCircuit className="h-4 w-4" />
                                                包含思考过程
                                            </Label>
                                            <Switch
                                                id="include-thoughts"
                                                checked={includeThoughts}
                                                onCheckedChange={setIncludeThoughts}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>思考预算: {budgetLabel}</Label>
                                            <Slider
                                                value={thinkingBudget}
                                                onValueChange={setThinkingBudget}
                                                max={8192}
                                                step={128}
                                                min={-1}
                                                disabled={!includeThoughts}
                                            />
                                            <p className="text-xs text-muted-foreground">指导AI思考的Token量。-1为动态，0为关闭。</p>
                                        </div>
                                    </div>

                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">取消</Button>
                    </DialogClose>
                    <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()}>
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        生成内容
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-lg font-semibold">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    AI 思考中...
                </div>
            </div>
        )}
    </div>
  );
}
