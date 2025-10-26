'use client';

import type { Chapter, Book, WorldSetting, Character, CommunityPrompt } from '@/lib/types';
import { getPrompts } from '@/lib/actions/community';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Bot, Sparkles, Loader2, Settings2, Users, BookOpen, BrainCircuit, ScanLine, SpellCheck2, ChevronRight, ClipboardCopy, Save, Download, FileText, MoreVertical, PenLine, Undo2 } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { saveChapterToFile, copyChapterToClipboard, saveBookToFile, copyBookToClipboard } from '@/lib/file-utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import InlineAIToolbar from './InlineAIToolbar';
import InlineAIPanel, { type InlineAIPanelValues } from './InlineAIPanel';


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
  const isMobile = useIsMobile();
  const [content, setContent] = useState(chapter.content);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
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

  // 剧情建议 Dialog 状态
  const [isPlotDialogOpen, setIsPlotDialogOpen] = useState(false);
  const [plotSystemPrompt, setPlotSystemPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return '人设提示词:输出下一章剧情细纲,需要按照以下格式输出\n“序列号＋一段故事内容”\n——\n直接用markdown 格式输出\n无需json的格式化输出';
    return localStorage.getItem('plot-system-prompt') || '人设提示词:输出下一章剧情细纲,需要按照以下格式输出\n“序列号＋一段故事内容”\n——\n直接用markdown 格式输出\n无需json的格式化输出';
  });
  const [plotUserPrompt, setPlotUserPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return 'ii';
    return localStorage.getItem('plot-user-prompt') || 'ii';
  });
  const [plotUseWorld, setPlotUseWorld] = useState(true);
  const [plotUseCharacters, setPlotUseCharacters] = useState(true);
  const [plotContextChapterIds, setPlotContextChapterIds] = useState<string[]>([]);
  const [isPlotStreaming, setIsPlotStreaming] = useState(false);
  const [plotStreamingOutput, setPlotStreamingOutput] = useState('');
  const [isPlotPreviewOpen, setIsPlotPreviewOpen] = useState(false);
  const plotClickCooldownRef = useRef<boolean>(false);

  // AI生图
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isImaging, setIsImaging] = useState(false);

  const togglePlotChapter = (id: string) => {
    setPlotContextChapterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
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
  const reachCompressThreshold = selectedContextChars >= 50000; // 5万字

  // Floating action bar visibility when near bottom of page
  const [showFab, setShowFab] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [showInlineBar, setShowInlineBar] = useState(false);
  const [selectionPreview, setSelectionPreview] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'expand' | 'rewrite' | 'custom'>('expand');
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


  // 最近一次续写的备份与分界线位置，用于撤回与定位
  const [lastAppendBackup, setLastAppendBackup] = useState<string | null>(null);
  const [dividerIndex, setDividerIndex] = useState<number | null>(null);
  const [inlineBackup, setInlineBackup] = useState<string | null>(null);

  const handleUndoLastAppend = () => {
    if (lastAppendBackup === null) return;
    setContent(lastAppendBackup);
    updateChapterContent(chapter.id, lastAppendBackup);
    setLastAppendBackup(null);
    setDividerIndex(null);
    toast({ title: '已撤回', description: '已撤回本次AI续写内容' });
  };

  const handleUndoInline = () => {
    if (inlineBackup === null) return;
    setContent(inlineBackup);
    updateChapterContent(chapter.id, inlineBackup);
    setInlineBackup(null);
    toast({ title: '已撤回', description: '已撤回本次AI改写/扩写修改' });
  };

  const handleJumpToDivider = () => {
    if (!textareaRef.current || dividerIndex === null) return;
    const ta = textareaRef.current;
    const pos = Math.min(Math.max(0, dividerIndex), (ta.value || '').length);
    ta.focus();
    try { ta.setSelectionRange(pos, pos); } catch {}
  };

  const copyText = async (text: string) => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast({ title: '已复制到剪贴板' });
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          toast({ title: '已复制到剪贴板' });
        } catch (err) {
          toast({ title: '复制失败', description: '请手动复制', variant: 'destructive' });
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      toast({ title: '复制失败', description: '请手动复制', variant: 'destructive' });
    }
  };

  // 保存当前章节
  const handleSaveChapter = async () => {
    try {
      await saveChapterToFile(chapter, fullContext.book.title);
      toast({ title: '保存成功', description: `已保存 ${chapter.title}` });
    } catch (error) {
      toast({ title: '保存失败', description: '请重试', variant: 'destructive' });
    }
  };

  // 复制当前章节
  const handleCopyChapter = async () => {
    const success = await copyChapterToClipboard(chapter, fullContext.book.title);
    if (success) {
      toast({ title: '已复制', description: `${chapter.title} 已复制到剪贴板` });
    } else {
      toast({ title: '复制失败', description: '请重试', variant: 'destructive' });
    }
  };

  // 导出整本书
  const handleExportBook = async () => {
    try {
      await saveBookToFile(fullContext.book);
      toast({ title: '导出成功', description: `已导出《${fullContext.book.title}》完整版` });
    } catch (error) {
      toast({ title: '导出失败', description: '请重试', variant: 'destructive' });
    }
  };

  // 复制整本书
  const handleCopyBook = async () => {
    const success = await copyBookToClipboard(fullContext.book);
    if (success) {
      toast({ title: '已复制', description: `《${fullContext.book.title}》已复制到剪贴板` });
    } else {
      toast({ title: '复制失败', description: '请重试', variant: 'destructive' });
    }
  };

  // 错字检查 Agent - 流式修改
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [proofOriginal, setProofOriginal] = useState('');
  const [isProofing, setIsProofing] = useState(false);
  const [isProofResultOpen, setIsProofResultOpen] = useState(false);
  const [proofDiffHtml, setProofDiffHtml] = useState('');
  
  // 校对提示词
  const DEFAULT_PROOF_PROMPT = `你是专业的中文校对助手。请逐行检查并修正文本中的错别字、标点错误、语序问题、重复词句。

**重要要求：**
1. 直接输出修正后的完整文本，不要添加任何解释或JSON格式
2. 保持原文的分段和格式
3. 只修正明显的错误，不改变原文风格和表达
4. 如果某段没有错误，原样输出`;
  const [proofPrompt, setProofPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROOF_PROMPT;
    return localStorage.getItem('proof-prompt') || DEFAULT_PROOF_PROMPT;
  });

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
      // 使用用户自定义的校对提示词
      const sys = proofPrompt;
      
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

  // 监听选择变化
  const handleSelectionCheck = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end > start && (ta.value || '').slice(start, end).trim()) {
      selectionRef.current = { start, end };
      const text = (ta.value || '').slice(start, end).replace(/\s+/g, ' ').slice(0, 60);
      setSelectionPreview(text);
      setShowInlineBar(true);
    } else {
      setShowInlineBar(false);
    }
  };

  const replaceSelection = (newText: string) => {
    const ta = textareaRef.current;
    if (!ta || !selectionRef.current) return;
    const { start, end } = selectionRef.current;
    const before = (content || '').slice(0, start);
    const after = (content || '').slice(end);
    const next = `${before}${newText}${after}`;
    // 记录撤回备份
    setInlineBackup(content);
    setContent(next);
    updateChapterContent(chapter.id, next);
    setShowInlineBar(false);
  };

  const runInlineAI = async (mode: 'expand' | 'rewrite' | 'custom', panel?: InlineAIPanelValues) => {
    const ta = textareaRef.current;
    if (!ta || !selectionRef.current) return;
    const { start, end } = selectionRef.current;
    const selected = (content || '').slice(start, end);
    if (!selected.trim()) return;
    if (!canGenerate) {
      toast({ title: '请先配置AI提供商', description: '点击右上角 AI 设置进行配置', variant: 'destructive' });
      return;
    }
    setInlineLoading(true);
    try {
      const sys = mode === 'expand'
        ? '你是资深网文写作助手：请对给定片段进行扩写，保持人物设定、语气、叙事视角一致，细节更丰富但不改变既有情节。'
        : mode === 'rewrite'
        ? '你是资深网文改写助手：请在不改变意思的前提下，优化遣词造句与节奏，使之更有可读性和韵律。'
        : '你是描写强化助手：根据用户指令对选中文本做定向描写强化，注意与上下文一致。';

      const customPrompt = panel?.prompt || (mode === 'custom' ? '' : '');
      const basePrompt = `${mode === 'expand' ? '扩写' : mode === 'rewrite' ? '改写' : '定向描写'}以下文本：\n${selected}`;
      // 拼接用户选项上下文
      let contextParts: string[] = [];
      if (panel?.useRoleCards) {
        // 当前书角色
        const characterContextSelf = fullContext.characters
          .filter(c => c.enabled)
          .map(c => `角色名: ${c.name}\n设定: ${c.description}`)
          .join('\n\n');
        const characterContext = characterContextSelf;
        if (characterContext) contextParts.push(`=== 角色设定 ===\n${characterContext}`);
      }
      if (panel?.useWorldBook) {
        // 当前书世界书
        const worldBookContextSelf = fullContext.worldSettings
          .filter(ws => ws.enabled && content.includes(ws.keyword))
          .map(ws => `关键词: ${ws.keyword}\n设定: ${ws.description}`)
          .join('\n\n');
        const worldBookContext = worldBookContextSelf;
        if (worldBookContext) contextParts.push(`=== 世界设定 ===\n${worldBookContext}`);
      }
      if (panel?.useChapterContext) {
        contextParts.push(`=== 当前章节全文 ===\n${content}`);
      }
      const addedContext = contextParts.length ? `\n\n${contextParts.join('\n\n')}` : '';
      const fullPrompt = `${basePrompt}${addedContext}` + (customPrompt ? `\n\n补充指令：${customPrompt}` : '');

      let result = '';
      for await (const chunk of aiGenerateContentStream(fullPrompt, { systemInstruction: sys, maxOutputTokens: 512 })) {
        result += chunk;
      }
      if (result.trim()) replaceSelection(result.trim());
    } catch (e: any) {
      toast({ title: 'AI处理失败', description: e?.message || '请稍后再试', variant: 'destructive' });
    } finally {
      setInlineLoading(false);
    }
  };

  const openPanel = (mode: 'expand' | 'rewrite' | 'custom') => {
    setPanelMode(mode);
    setPanelOpen(true);
  };

  const handlePanelConfirm = (values: InlineAIPanelValues) => {
    setPanelOpen(false);
    runInlineAI(panelMode, values);
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
      const systemInstruction = `${aiRole}

${characterContext ? `\n=== 角色设定 ===\n${characterContext}\n` : ''}
${worldBookContext ? `\n=== 世界设定 ===\n${worldBookContext}\n` : ''}
${fullChapterContext ? `\n=== 当前章节内容 ===\n${fullChapterContext}\n` : ''}`;

      // 使用流式生成
      setIsStreaming(true);
      setStreamingContent('');
      let fullResult = '';
      
      const stream = aiGenerateContentStream(prompt, {
        temperature: temperature[0],
        maxOutputTokens: maxTokens[0],
        systemInstruction,
      });

      // 追加模式：在当前内容末尾追加AI生成的内容，并加上分界线
      const baseContent = content;
      const DIVIDER = "\n\n——— AI续写分界线（本次生成，可撤回）———\n\n";
      setLastAppendBackup(baseContent);
      setDividerIndex(baseContent.length + 2);
      for await (const chunk of stream) {
        fullResult += chunk;
        setStreamingContent(fullResult);
        // 实时更新编辑器内容（在分界线后追加）
        const newContent = baseContent + DIVIDER + fullResult;
        setContent(newContent);
      }
      
      setIsStreaming(false);
      setStreamingContent('');
      const finalContent = baseContent + DIVIDER + fullResult;
      updateChapterContent(chapter.id, finalContent);
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
      setIsStreaming(false);
      setStreamingContent('');
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
        <div className="px-2 py-2 sm:px-4 sm:py-3 border-b flex justify-between items-center gap-2">
            <h2 className="text-base sm:text-lg md:text-2xl font-bold font-headline truncate flex-1 min-w-0">{chapter.title}</h2>
            <div className='flex items-center gap-1 sm:gap-2 flex-shrink-0'>
                <div className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">字数：<span className="font-medium">{currentCount}</span></div>
                
                {/* 保存/导出下拉菜单 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size={isMobile ? "sm" : "default"} className={isMobile ? "h-8 px-2" : ""}>
                      <Save className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4 mr-2"} />
                      {!isMobile && "保存"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleSaveChapter}>
                      <Save className="h-4 w-4 mr-2" />
                      保存当前章节
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyChapter}>
                      <ClipboardCopy className="h-4 w-4 mr-2" />
                      复制当前章节
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportBook}>
                      <Download className="h-4 w-4 mr-2" />
                      导出整本书
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyBook}>
                      <FileText className="h-4 w-4 mr-2" />
                      复制整本书
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {!isMobile && <AIProviderSettings showStatus={true} />}
                {!isMobile && <AiDetector text={content} />}
            </div>
        </div>
        <ScrollArea className="flex-grow" ref={scrollRootRef as any}>
            <Textarea
                ref={textareaRef as any}
                value={content}
                onChange={handleContentChange}
                onSelect={handleSelectionCheck}
                onKeyUp={handleSelectionCheck}
                placeholder="在这里开始你的故事..."
                className="w-full h-full text-sm sm:text-base resize-none border-0 focus:ring-0 focus-visible:ring-0 p-3 sm:p-4 md:p-6 bg-transparent"
                style={{minHeight: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 160px)'}}
            />
            {/* 内联 AI 工具栏 */}
            <div className="sticky bottom-3 right-3 flex justify-end px-3">
              <InlineAIToolbar
                isOpen={showInlineBar}
                loading={inlineLoading}
                onExpandClick={() => openPanel('expand')}
                onRewriteClick={() => openPanel('rewrite')}
                onCustomClick={() => openPanel('custom')}
                onImageClick={() => setIsImageDialogOpen(true)}
                onClose={() => setShowInlineBar(false)}
              />
            </div>
            <InlineAIPanel
              open={panelOpen}
              title={panelMode === 'expand' ? 'AI扩写' : panelMode === 'rewrite' ? 'AI改写' : '自定义描写'}
              defaultPrompt={panelMode === 'custom' ? '加强动态与氛围，加入细节对比' : ''}
              onClose={() => setPanelOpen(false)}
              onConfirm={handlePanelConfirm}
            />
            <div ref={bottomSentinelRef} className="h-1" />
        </ScrollArea>
        
        {/* 底部浮出操作条（接近页面底部时显示） */}
        {showFab && !isMobile && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background/80 border rounded-full px-2 py-1 shadow-md">
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setIsAiDialogOpen(true)}>
              <PenLine className="h-4 w-4 mr-1" /> 剧情续写
            </Button>
            {lastAppendBackup && (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3" onClick={handleJumpToDivider}>
                  <ScanLine className="h-4 w-4 mr-1" /> 到分界线
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-3" onClick={handleUndoLastAppend}>
                  <Undo2 className="h-4 w-4 mr-1" /> 撤回续写
                </Button>
              </>
            )}
            {inlineBackup && (
              <Button size="sm" variant="ghost" className="h-8 px-3" onClick={handleUndoInline}>
                <Undo2 className="h-4 w-4 mr-1" /> 撤回改写
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setIsProofDialogOpen(true)}>
              <SpellCheck2 className="h-4 w-4 mr-1" /> 检查错字
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setIsPlotDialogOpen(true)}>
              <ChevronRight className="h-4 w-4 mr-1" /> 剧情建议
            </Button>
          </div>
        )}
        
        {/* 移动端底部工具栏 */}
        {isMobile && (
          <div className="border-t bg-background p-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" className="h-9 text-xs px-2 flex-1" onClick={() => setIsAiDialogOpen(true)}>
              <PenLine className="h-4 w-4 mr-1" /> 续写
            </Button>
            <Button size="sm" variant="ghost" className="h-9 text-xs px-2 flex-1" onClick={() => setIsProofDialogOpen(true)}>
              <SpellCheck2 className="h-4 w-4 mr-1" /> 检查
            </Button>
            {inlineBackup && (
              <Button size="sm" variant="ghost" className="h-9 text-xs px-2 flex-1" onClick={handleUndoInline}>
                <Undo2 className="h-4 w-4 mr-1" /> 撤回改写
              </Button>
            )}
            <AIProviderSettings showStatus={false} variant="ghost" />
            <AiDetector text={content} />
          </div>
        )}

        {/* 校对结果对比 Dialog */}
        <Dialog open={isProofResultOpen} onOpenChange={setIsProofResultOpen}>
          <DialogContent className={isMobile ? "w-full h-full max-w-full p-4" : "sm:max-w-[720px]"}>
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
        {/* 剧情建议 Dialog */}
        <Dialog open={isPlotDialogOpen} onOpenChange={(o) => { setIsPlotDialogOpen(o); if (!o) { setPlotStreamingOutput(''); setIsPlotStreaming(false); } }}>
          <DialogContent className={isMobile ? "w-full h-[100vh] max-w-full p-3 flex flex-col" : "sm:max-w-[900px] max-h-[92vh] p-4 flex flex-col"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> 剧情建议</DialogTitle>
              <DialogDescription>可选择上下文（章节/角色卡/世界书），AI输出下一章剧情细纲（Markdown）。</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-2 text-sm">
              {/* 顶部两列：左侧模型+开关，右侧提示词 */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">AI模型</Label>
                    <ModelSelector
                      selectedProviderId={selectedProviderId}
                      selectedModelId={selectedModelId}
                      onProviderChange={setSelectedProvider}
                      onModelChange={setSelectedModel}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2"><Switch checked={plotUseWorld} onCheckedChange={setPlotUseWorld} /> 使用世界书</label>
                    <label className="flex items-center gap-2"><Switch checked={plotUseCharacters} onCheckedChange={setPlotUseCharacters} /> 使用角色卡</label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">系统提示词</Label>
                  <Textarea className="text-sm" rows={2} value={plotSystemPrompt} onChange={(e) => { setPlotSystemPrompt(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('plot-system-prompt', e.target.value); }} />
                  <Label className="text-xs">用户提示词</Label>
                  <Textarea className="text-sm" rows={4} value={plotUserPrompt} onChange={(e) => { setPlotUserPrompt(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('plot-user-prompt', e.target.value); }} />
                </div>
              </div>

              {/* 中部两列：左侧章节选择，右侧AI输出 */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">选择上下文章节（可多选）</Label>
                  <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                    {otherChapters.length === 0 ? (
                      <p className="text-xs text-muted-foreground">没有可选章节</p>
                    ) : (
                      otherChapters.map(ch => (
                        <label key={ch.id} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input type="checkbox" className="mt-1" checked={plotContextChapterIds.includes(ch.id)} onChange={() => togglePlotChapter(ch.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{ch.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{(ch.content || '').slice(0, 120)}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs">AI输出{isPlotStreaming && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}</Label>
                    <Button size="sm" variant="outline" onClick={() => setIsPlotPreviewOpen(true)}>全部预览</Button>
                  </div>
                  <div className="p-3 border rounded bg-muted/30 text-sm whitespace-pre-wrap break-words max-h-64 overflow-auto">
                    {plotStreamingOutput || '正在连接AI...'}
                    {isPlotStreaming && <span className="animate-pulse">▋</span>}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
              <Button
                onClick={async () => {
                  if (isPlotStreaming || plotClickCooldownRef.current) { return; }
                  plotClickCooldownRef.current = true;
                  setTimeout(() => { plotClickCooldownRef.current = false; }, 800);
                  if (!selectedModelId || !selectedProviderId) { toast({ title: '请先选择模型', variant: 'destructive' }); return; }
                  setIsPlotStreaming(true); setPlotStreamingOutput('');
                  // 组装上下文
                  const contextParts: string[] = [];
                  const pick = (t: string) => { if (t && t.trim()) contextParts.push(t.trim()); };
                  // 当前章节
                  pick(`【当前章节】\n${content || ''}`);
                  // 选中上下文章节
                  const ctx = fullContext.book.chapters.filter(c => plotContextChapterIds.includes(c.id));
                  ctx.forEach(c => pick(`【上下文：${c.title}】\n${c.content || ''}`));
                  // 角色卡
                  if (plotUseCharacters) {
                    const enabledChars = (fullContext.characters || []).filter(c => c.enabled);
                    if (enabledChars.length) pick(`【角色卡】\n${enabledChars.map(c => `- ${c.name}: ${c.description}`).join('\n')}`);
                  }
                  // 世界书
                  if (plotUseWorld) {
                    const enabledWorld = (fullContext.worldSettings || []).filter(w => w.enabled);
                    if (enabledWorld.length) pick(`【世界书】\n${enabledWorld.map(w => `- ${w.keyword}: ${w.description}`).join('\n')}`);
                  }
                  const finalInput = `${plotSystemPrompt}\n\n${contextParts.join('\n\n')}\n\n${plotUserPrompt}`;
                  try {
                    let full = '';
                    const stream = aiGenerateContentStream(finalInput, { systemInstruction: plotSystemPrompt, maxOutputTokens: maxTokens[0] });
                    for await (const chunk of stream) { full += chunk; setPlotStreamingOutput(full); }
                  } catch (e: any) {
                    toast({ title: '生成失败', description: e?.message || '请稍后重试', variant: 'destructive' });
                  } finally { setIsPlotStreaming(false); }
                }}
              >
                生成剧情建议
              </Button>
              <Button
                variant="outline"
                disabled={!plotStreamingOutput.trim()}
                onClick={() => {
                  // 导入到写作助手的“你的细纲”
                  setPrompt(prev => {
                    const base = prev?.trim() ? prev + '\n\n' : '';
                    return base + (plotStreamingOutput || '').trim();
                  });
                  toast({ title: '已导入到你的细纲' });
                }}
              >
                导入到你的细纲
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 全部预览：只显示AI文本的大卡片 */}
        <Dialog open={isPlotPreviewOpen} onOpenChange={setIsPlotPreviewOpen}>
          <DialogContent className={isMobile ? "w-full h-[100vh] max-w-full p-3" : "sm:max-w-[900px] max-h-[92vh] p-4"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> 剧情建议 - 全部预览</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="p-4 border rounded bg-muted/30 text-sm whitespace-pre-wrap break-words">
                {plotStreamingOutput || '暂无内容'}
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild><Button variant="secondary">关闭</Button></DialogClose>
              <Button
                onClick={() => {
                  setPrompt(prev => {
                    const base = prev?.trim() ? prev + '\n\n' : '';
                    return base + (plotStreamingOutput || '').trim();
                  });
                  toast({ title: '已导入到你的细纲' });
                  setIsPlotPreviewOpen(false);
                }}
                disabled={!plotStreamingOutput.trim()}
              >
                导入到你的细纲
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI生图 Dialog */}
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <DialogContent className={isMobile ? "w-full h-[100vh] max-w-full p-3" : "sm:max-w-[880px] max-h-[90vh] p-4"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> AI 生图</DialogTitle>
              <DialogDescription>基于所选内容或自定义提示词生成图片。默认取选中文本，未选择则取当前段落。</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">提示词</Label>
                <Textarea rows={5} value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="输入或粘贴你的生图提示词" />
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Button size="sm" variant="outline" onClick={() => setImagePrompt(selectionPreview || content.slice(0, 160))}>用选择内容</Button>
                  <Button size="sm" variant="outline" onClick={() => setImagePrompt(content.slice(Math.max(0, content.length - 240), content.length))}>用当前段落</Button>
                </div>
                <div className="pt-2">
                  <Button onClick={async () => {
                    if (!imagePrompt.trim()) { toast({ title: '请输入生图提示词', variant: 'destructive' }); return; }
                    setIsImaging(true); setImageUrls([]);
                    try {
                      const res = await fetch('/api/ai-image/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: imagePrompt.trim() }) });
                      const data = await res.json();
                      if (!res.ok || !data?.success) throw new Error(data?.error || '生成失败');
                      setImageUrls(Array.isArray(data?.urls) ? data.urls : []);
                    } catch (e: any) {
                      toast({ title: '生成失败', description: e?.message || '请稍后重试', variant: 'destructive' });
                    } finally { setIsImaging(false); }
                  }} disabled={isImaging}>
                    {isImaging ? '生成中...' : '开始生成'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">预览</Label>
                {imageUrls.length === 0 ? (
                  <div className="h-72 border rounded flex items-center justify-center text-xs text-muted-foreground">暂无图片</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
                    {imageUrls.map((u, i) => (
                      <div key={u + i} className="relative group">
                        <img src={u} alt={`img-${i}`} className="w-full h-40 object-cover rounded border" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                        <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <a href={u} target="_blank" rel="noreferrer" className="text-white text-xs px-2 py-1 bg-black/60 rounded">打开</a>
                          <button onClick={() => navigator.clipboard.writeText(u)} className="text-white text-xs px-2 py-1 bg-black/60 rounded">复制URL</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="secondary">关闭</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* 错字检查 Agent Dialog */}
        <Dialog open={isProofDialogOpen} onOpenChange={(open) => { setIsProofDialogOpen(open); if (!open && !isProofing) { setProofOriginal(''); } }}>
          <DialogContent className={isMobile ? "w-full h-full max-w-full p-4" : "sm:max-w-[550px]"}>
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
              
              <div className="space-y-2">
                <Label htmlFor="proof-prompt">校对提示词</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { 
                    setProofPrompt(DEFAULT_PROOF_PROMPT); 
                    if (typeof window !== 'undefined') localStorage.setItem('proof-prompt', DEFAULT_PROOF_PROMPT); 
                  }}>
                    重置默认
                  </Button>
                </div>
                <Textarea 
                  id="proof-prompt"
                  rows={6} 
                  value={proofPrompt} 
                  onChange={(e) => { 
                    setProofPrompt(e.target.value); 
                    if (typeof window !== 'undefined') localStorage.setItem('proof-prompt', e.target.value); 
                  }} 
                  placeholder="输入校对提示词，指导AI如何校对文本" 
                />
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
                 <Button className={isMobile ? "fixed bottom-20 right-4 rounded-full h-14 w-14 shadow-lg z-30" : "absolute bottom-6 right-6 rounded-full h-12 w-12 shadow-lg"}>
                    <Sparkles className={isMobile ? "h-7 w-7" : "h-6 w-6"} />
                 </Button>
            </DialogTrigger>
            <DialogContent className={isMobile ? "w-full h-full max-w-full p-4" : "sm:max-w-[480px]"}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-headline text-lg"><Bot /> AI 写作助手</DialogTitle>
                    <DialogDescription>
                        配置 AI 人设和细纲，生成的内容将追加到章节末尾。可选择关联上下文章节。
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="ai-role">提示词卡</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="ai-role" 
                                    value={aiRoleDisplay} 
                                    onChange={handleAiRoleInputChange}
                                    placeholder="例如：你是一个擅长爽点设计与反转的网文作者，精于承接前文并自然引出下一章的冲突与悬念。请基于上文续写"
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
                            <div className="flex items-center justify-between">
                              <Label htmlFor="ai-prompt">你的细纲</Label>
                              <Button type="button" size="sm" variant="outline" onClick={() => window.open('/bookstore','_blank')}>书城</Button>
                            </div>
                            <Textarea 
                                id="ai-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="打开书城随便选择一本书拆细纲复制"
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
                        {isLoading ? (isStreaming ? 'AI生成中...' : '正在处理...') : '生成内容'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
