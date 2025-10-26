'use client';

import type { Character, Chapter, Book } from '@/lib/types';
import { useState, useEffect } from 'react';
import { generateUUID, decideMatchForCharacter, normalizeChineseName } from '@/lib/utils';
import { useAI } from '@/hooks/useAI';
import { useAIConfig } from '@/hooks/useAIConfig';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Plus, Trash2, Edit, Settings, SlidersHorizontal, Bot, Book as BookIcon } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import ModelSelector from './ModelSelector';
import { AIProviderSettings } from './AIProviderSettings';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';

interface CharacterCardManagerProps {
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  chapters?: Chapter[];
  currentBookId?: string;
}

export default function CharacterCardManager({ characters, setCharacters, chapters = [], currentBookId }: CharacterCardManagerProps) {
  const { toast } = useToast();
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Character | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [linkedBookIds, setLinkedBookIds] = useState<string[]>([]);
  const [books] = useLocalStorage<Book[]>('books', []);
  const [isPickOpen, setIsPickOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [debugViewOnly, setDebugViewOnly] = useState(false);
  const [noLengthLimit, setNoLengthLimit] = useState(false);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [streamingOutput, setStreamingOutput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  // 书城章节提取状态
  const [extractMode, setExtractMode] = useState<'local' | 'bookstore'>('local');
  const [bookSources, setBookSources] = useState<any[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [bookstoreBooks, setBookstoreBooks] = useState<any[]>([]);
  const [selectedBookstoreBook, setSelectedBookstoreBook] = useState<string>('');
  const [bookstoreChapters, setBookstoreChapters] = useState<any[]>([]);
  const [selectedBookstoreChapterIds, setSelectedBookstoreChapterIds] = useState<string[]>([]);
  const [isLoadingBookstoreChapters, setIsLoadingBookstoreChapters] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 串行处理状态
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [processingCurrent, setProcessingCurrent] = useState('');

  // 使用统一AI配置和调用
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();
  const { generateContent: aiGenerateContent, generateContentStream: aiGenerateContentStream, canGenerate } = useAI();

  // 配置弹窗状态
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // 自定义提示词配置
  const DEFAULT_SYSTEM_PROMPT = '你是资深的小说设定分析师。基于给定正文，抽取"角色卡"。每个角色包含：name（不超过10字），description（150-300字，包含身份、性格、动机与与主角关系）。以JSON数组返回，每项为{"name":"...","description":"..."}，不要输出其他内容。';
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_SYSTEM_PROMPT;
    return localStorage.getItem('character-extract-system-prompt') || DEFAULT_SYSTEM_PROMPT;
  });

  // Token限制配置
  const [maxTokens, setMaxTokens] = useState<number>(() => {
    if (typeof window === 'undefined') return 2048;
    const saved = localStorage.getItem('character-extract-max-tokens');
    const n = saved ? parseInt(saved, 10) : 2048;
    return Number.isFinite(n) && n > 256 ? n : 2048;
  });

  // 保存配置到本地存储
  const persistSystemPrompt = (prompt: string) => {
    setSystemPrompt(prompt);
    if (typeof window !== 'undefined') {
      localStorage.setItem('character-extract-system-prompt', prompt);
    }
  };

  const persistMaxTokens = (tokens: number) => {
    setMaxTokens(tokens);
    if (typeof window !== 'undefined') {
      localStorage.setItem('character-extract-max-tokens', String(tokens));
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingItem(null);
    setLinkedBookIds([]);
  };

  const handleSave = () => {
    if (!name.trim() || !description.trim()) return;

    if (editingItem) {
      const updated = characters.map(item =>
        item.id === editingItem.id ? { ...item, name, description, linkedBookIds } : item
      );
      setCharacters(updated);
    } else {
      const newItem: Character = {
        id: generateUUID(),
        name: name.trim(),
        description: description.trim(),
        enabled: true,
        linkedBookIds,
      };
      setCharacters([...characters, newItem]);
    }
    resetForm();
    setIsNewItemDialogOpen(false);
  };

  const handleEditClick = (character: Character) => {
    setEditingItem(character);
    setName(character.name);
    setDescription(character.description);
    setLinkedBookIds(character.linkedBookIds || []);
    setIsNewItemDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setCharacters(characters.filter(item => item.id !== id));
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setCharacters(
      characters.map(item => (item.id === id ? { ...item, enabled } : item))
    );
  };

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds(prev => prev.includes(chapterId) ? prev.filter(id => id !== chapterId) : [...prev, chapterId]);
  };

  const toggleBookstoreChapterSelection = (chapterId: string) => {
    setSelectedBookstoreChapterIds(prev => prev.includes(chapterId) ? prev.filter(id => id !== chapterId) : [...prev, chapterId]);
  };

  // 加载书源列表
  useEffect(() => {
    if (extractMode === 'bookstore' && isAiDialogOpen && bookSources.length === 0) {
      setIsLoadingSources(true);
      fetch('/api/get-book-sources')
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data?.sources) ? data.sources : [];
          const enabled = list.filter((s: any) => s.enabled);
          setBookSources(enabled);
          if (enabled.length > 0 && !selectedSourceId) {
            setSelectedSourceId(enabled[0].id);
          }
        })
        .catch(e => toast({ title: '加载书源失败', description: e.message, variant: 'destructive' }))
        .finally(() => setIsLoadingSources(false));
    }
  }, [extractMode, isAiDialogOpen, bookSources.length, selectedSourceId, toast]);

  // 搜索书城书籍
  const handleBookstoreSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: '请输入搜索关键词', variant: 'destructive' });
      return;
    }
    if (!selectedSourceId) {
      toast({ title: '请先选择书源', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(`/api/bookstore/search?q=${encodeURIComponent(searchQuery.trim())}&sourceId=${selectedSourceId}`);
      if (!res.ok) throw new Error('搜索失败');
      const data = await res.json();
      setBookstoreBooks(Array.isArray(data.books) ? data.books : []);
      if (!data.books || data.books.length === 0) {
        toast({ title: '未找到结果', description: '请尝试其他关键词或换个书源', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: '搜索失败', description: e.message, variant: 'destructive' });
      setBookstoreBooks([]);
    }
  };

  // 加载书籍章节列表
  const loadBookstoreChapters = async (bookUrl: string, sourceId: string) => {
    if (!bookUrl || !sourceId) return;
    setIsLoadingBookstoreChapters(true);
    try {
      const res = await fetch(`/api/bookstore/book?url=${encodeURIComponent(bookUrl)}&sourceId=${sourceId}`);
      if (!res.ok) throw new Error('加载章节失败');
      const data = await res.json();
      setBookstoreChapters(Array.isArray(data?.book?.chapters) ? data.book.chapters : []);
    } catch (e: any) {
      toast({ title: '加载章节失败', description: e.message, variant: 'destructive' });
      setBookstoreChapters([]);
    } finally {
      setIsLoadingBookstoreChapters(false);
    }
  };

  // 获取单章内容
  const fetchChapterContent = async (chapterUrl: string, sourceId: string): Promise<string> => {
    const res = await fetch(`/api/bookstore/chapter?url=${encodeURIComponent(chapterUrl)}&sourceId=${sourceId}`);
    if (!res.ok) throw new Error('获取章节内容失败');
    const data = await res.json();
    return data?.chapter?.content || '';
  };

  // 按书ID持久化当前书的角色卡，供“从其他书导入”使用；仅保存，不做任何自动导入
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && currentBookId) {
        window.localStorage.setItem(`characterCards:${currentBookId}`, JSON.stringify(characters));
      }
    } catch {}
  }, [characters, currentBookId]);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importBookId, setImportBookId] = useState('');
  const [importItems, setImportItems] = useState<Character[]>([]);
  const [importSelected, setImportSelected] = useState<string[]>([]);
  const loadImportItems = (bookId: string) => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`characterCards:${bookId}`) : null;
      if (!raw) { setImportItems([]); return; }
      const arr: any[] = JSON.parse(raw);
      const items: Character[] = (Array.isArray(arr) ? arr : []).map((it: any) => ({
        id: generateUUID(),
        name: String(it?.name || ''),
        description: String(it?.description || ''),
        enabled: Boolean(it?.enabled),
        linkedBookIds: Array.isArray(it?.linkedBookIds) ? it.linkedBookIds : [],
      }));
      setImportItems(items);
    } catch (e: any) {
      setImportItems([]);
    }
  };
  const importCommit = () => {
    const selected = importItems.filter(it => importSelected.includes(it.id));
    if (selected.length === 0) return;
    setCharacters([...characters, ...selected.map(s => ({ ...s, id: generateUUID() }))]);
    setIsImportOpen(false);
    setImportBookId('');
    setImportItems([]);
    setImportSelected([]);
    toast({ title: '导入成功', description: `已导入 ${selected.length} 个角色` });
  };

  const handleAiExtract = async () => {
    // 检查是否有选中的章节
    const chaptersToProcess = extractMode === 'local' ? selectedChapterIds : selectedBookstoreChapterIds;
    if (chaptersToProcess.length === 0) return;
    
    if (!canGenerate) {
      setIsConfigOpen(true);
      toast({
        title: '请先配置AI提供商',
        description: '已为您打开配置面板，请配置AI提供商和模型',
        variant: 'destructive'
      });
      return;
    }

    setIsExtracting(true);
    setProcessingTotal(chaptersToProcess.length);
    setProcessingProgress(0);
    setStreamingOutput('');
    setRawOutput('');
    
    const allNewCards: Character[] = [];
    
    try {
      // 串行处理每个章节
      for (let i = 0; i < chaptersToProcess.length; i++) {
        const chapterId = chaptersToProcess[i];
        setProcessingProgress(i);
        
        try {
          let chapterTitle = '';
          let chapterContent = '';
          
          // 根据模式获取章节内容
          if (extractMode === 'local') {
            const chapter = chapters.find(ch => ch.id === chapterId);
            if (!chapter) continue;
            chapterTitle = chapter.title;
            chapterContent = chapter.content || '';
          } else {
            // 书城模式
            const chapter = bookstoreChapters.find(ch => ch.url === chapterId);
            if (!chapter) continue;
            chapterTitle = chapter.title;
            setProcessingCurrent(`正在获取《${chapterTitle}》内容...`);
            chapterContent = await fetchChapterContent(chapter.url, selectedSourceId);
          }
          
          setProcessingCurrent(`正在处理《${chapterTitle}》(${i + 1}/${chaptersToProcess.length})`);
          setIsStreaming(true);
          setStreamingOutput('');
          
          // 处理章节内容
          let joined = `【${chapterTitle}】\n${chapterContent}`;
          if (!noLengthLimit) {
            const compact = joined
              .replace(/\u00A0/g, ' ')
              .replace(/[\t ]{2,}/g, ' ')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            const LIMIT = (() => {
              if (typeof window === 'undefined') return 12000;
              const val = parseInt(localStorage.getItem('ai-extract-char-limit') || '12000', 10);
              return Number.isFinite(val) && val > 2000 ? val : 12000;
            })();
            joined = compact.length > LIMIT ? compact.slice(0, LIMIT) : compact;
          }
          
          const opts = { systemInstruction: systemPrompt, maxOutputTokens: maxTokens } as const;
          
          // 流式生成
          let fullOutput = '';
          const stream = aiGenerateContentStream(joined, opts);
          
          for await (const chunk of stream) {
            fullOutput += chunk;
            setStreamingOutput(fullOutput);
          }
          
          setIsStreaming(false);
          
          // 解析结果
          const tryParseArray = (text: string): Array<{ name: string; description: string }> => {
            try { return JSON.parse(text.trim()); } catch {}
            try {
              const stripped = text
                .replace(/^```[a-zA-Z]*\s*/m, '')
                .replace(/```\s*$/m, '')
                .trim();
              return JSON.parse(stripped);
            } catch {}
            try {
              const start = text.indexOf('[');
              const end = text.lastIndexOf(']');
              if (start !== -1 && end !== -1 && end > start) {
                const sub = text.substring(start, end + 1);
                return JSON.parse(sub);
              }
            } catch {}
            try {
              const s = text.indexOf('{');
              const e = text.lastIndexOf('}');
              if (s !== -1 && e !== -1 && e > s) {
                const obj = JSON.parse(text.substring(s, e + 1));
                if (obj && (obj.name || obj.description)) return [obj];
              }
            } catch {}
            return [];
          };
          
          if (!debugViewOnly) {
            const parsed = tryParseArray(fullOutput);
            const newCards: Character[] = [];
            for (const c of (parsed || [])) {
              const candName = String(c.name || '').slice(0, 20);
              const cand: Character = {
                id: generateUUID(),
                name: candName,
                description: String(c.description || ''),
                enabled: true,
                aliases: [],
                canonicalName: normalizeChineseName(candName),
              };
              // 轻量实体对齐：与已存在角色尝试合并
              const decision = decideMatchForCharacter(
                { id: cand.id, name: cand.name, description: cand.description, aliases: cand.aliases },
                characters.map(ch => ({ id: ch.id, name: ch.name, description: ch.description, aliases: ch.aliases }))
              );
              if (decision.type === 'autoMerge' && decision.targetId) {
                const targetId = decision.targetId;
                const merged = characters.map(ch => {
                  if (ch.id !== targetId) return ch;
                  const aliases = Array.from(new Set([...(ch.aliases || []), cand.name]));
                  return { 
                    ...ch, 
                    aliases, 
                    description: ch.description && cand.description ? `${ch.description}\n（补充）${cand.description}` : (ch.description || cand.description),
                  };
                });
                // 立即写回，保证后续候选继续参考已合并结果
                setCharacters(merged);
              } else {
                newCards.push(cand);
              }
            }
            allNewCards.push(...newCards);
          }
          
        } catch (e: any) {
          console.error(`处理章节 ${i + 1} 失败:`, e);
          toast({
            title: `章节 ${i + 1} 处理失败`,
            description: e?.message || '继续处理下一章节',
            variant: 'destructive'
          });
          // 继续处理下一章节
        }
      }
      
      // 所有章节处理完成
      setProcessingProgress(chaptersToProcess.length);
      
      if (allNewCards.length > 0) {
        setCharacters([...characters, ...allNewCards]);
        setIsAiDialogOpen(false);
        setSelectedChapterIds([]);
        setSelectedBookstoreChapterIds([]);
        setStreamingOutput('');
        toast({
          title: '提取成功',
          description: `成功从 ${chaptersToProcess.length} 个章节中提取了 ${allNewCards.length} 个角色`,
        });
      } else {
        toast({
          title: '未找到角色',
          description: 'AI未能从选中章节中识别出有效角色信息',
          variant: 'destructive'
        });
      }
      
    } catch (e: any) {
      console.error('AI 解析角色失败:', e);
      toast({
        title: 'AI提取失败',
        description: e?.message || '角色提取过程中发生错误',
        variant: 'destructive'
      });
    } finally {
      setIsExtracting(false);
      setIsStreaming(false);
      setProcessingProgress(0);
      setProcessingTotal(0);
      setProcessingCurrent('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-1">
        <Dialog open={isNewItemDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsNewItemDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              添加新角色
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? '编辑角色' : '添加新角色'}</DialogTitle>
              <DialogDescription>
                创建或修改你的角色卡。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">角色名</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="description">角色设定</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>关联到其他书籍</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Popover open={isPickOpen} onOpenChange={setIsPickOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">选择书籍</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 max-h-72 overflow-auto" align="start">
                      {books.length === 0 ? (
                        <p className="text-xs text-muted-foreground">书架为空。</p>
                      ) : (
                        <div className="space-y-1">
                          {books.map(b => (
                            <label key={b.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={linkedBookIds.includes(b.id)}
                                onChange={() => setLinkedBookIds(prev => prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id])}
                              />
                              <span className="truncate">{b.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <div className="text-xs text-muted-foreground flex-1 truncate">
                    {linkedBookIds.length > 0 ? `已选 ${linkedBookIds.length} 本` : '未选择'}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">这里只保存关联关系；真正是否引入由你在使用处决定。</p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              <Button onClick={handleSave}>{editingItem ? '保存更改' : '创建'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isImportOpen} onOpenChange={(o) => { setIsImportOpen(o); if (!o) { setImportBookId(''); setImportItems([]); setImportSelected([]);} }}>
          <DialogTrigger asChild>
            <Button className="w-full mt-2">从其他书导入</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>选择一本书以导入角色卡</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>书籍</Label>
              <div className="max-h-60 overflow-auto border rounded p-2 space-y-1">
                {books.length === 0 ? (
                  <p className="text-xs text-muted-foreground">书架为空。</p>
                ) : (
                  books.map(b => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="import-book" checked={importBookId === b.id} onChange={() => { setImportBookId(b.id); loadImportItems(b.id); }} />
                      <span className="truncate">{b.title}</span>
                    </label>
                  ))
                )}
              </div>
              {importBookId && (
                <div className="space-y-2 mt-3">
                  <Label>选择要导入的角色</Label>
                  <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
                    {importItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">该书暂无可导入角色</p>
                    ) : (
                      importItems.map(it => (
                        <label key={it.id} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={importSelected.includes(it.id)} onChange={() => setImportSelected(prev => prev.includes(it.id) ? prev.filter(id => id !== it.id) : [...prev, it.id])} />
                          <div>
                            <div className="font-medium">{it.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{it.description}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              <Button onClick={importCommit} disabled={!importBookId || importSelected.length === 0}>导入</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-2">AI 自动获取</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>AI自动提取角色卡</span>
                <div className="flex items-center gap-2">
                  <Popover open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative">
                        <SlidersHorizontal className="w-4 h-4" />
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
                        
                        <div className="space-y-3">
                          <Label>AI模型选择</Label>
                          <ModelSelector 
                            selectedProviderId={selectedProviderId} 
                            selectedModelId={selectedModelId} 
                            onProviderChange={setSelectedProvider} 
                            onModelChange={setSelectedModel} 
                            showLabels={false} 
                            showModelInfo={true}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor='max-tokens-select'>最大输出长度</Label>
                          <Select value={String(maxTokens)} onValueChange={(v) => persistMaxTokens(parseInt(v, 10))}>
                            <SelectTrigger id='max-tokens-select'>
                              <SelectValue placeholder="选择最大输出长度" />
                            </SelectTrigger>
                            <SelectContent>
                              {[512, 1024, 1536, 2048, 3072, 4096, 6144, 8192].map(n => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            角色提取建议使用2048-4096，过小可能截断角色信息
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="system-prompt">系统提示词</Label>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => persistSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                            >
                              重置默认
                            </Button>
                          </div>
                          <Textarea 
                            id="system-prompt" 
                            rows={4} 
                            value={systemPrompt} 
                            onChange={(e) => persistSystemPrompt(e.target.value)} 
                            placeholder="输入系统提示词，定义AI如何提取角色信息" 
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <AIProviderSettings variant="ghost" showStatus={true} />
                </div>
              </DialogTitle>
              <DialogDescription>选择章节后，AI将逐章提取角色信息，避免并发和token超限。</DialogDescription>
            </DialogHeader>
            
            <Tabs value={extractMode} onValueChange={(v) => setExtractMode(v as 'local' | 'bookstore')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local">本地章节</TabsTrigger>
                <TabsTrigger value="bookstore">书城章节</TabsTrigger>
              </TabsList>
              
              <TabsContent value="local" className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={noLengthLimit} onChange={(e) => setNoLengthLimit(e.target.checked)} />
                    不做长度限制（调试）
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={debugViewOnly} onChange={(e) => setDebugViewOnly(e.target.checked)} />
                    仅查看原始输出（不入库）
                  </label>
                </div>
                {chapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">当前书籍暂无章节</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto border rounded p-2 space-y-2">
                    {chapters.map((ch) => (
                      <label key={ch.id} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input type="checkbox" className="mt-1" checked={selectedChapterIds.includes(ch.id)} onChange={() => toggleChapterSelection(ch.id)} />
                        <div className="flex-1 min-w-0">
                          <div className='font-medium truncate'>{ch.title}</div>
                          <div className='text-xs text-muted-foreground line-clamp-2'>{ch.content?.slice(0, 120) || ''}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="bookstore" className="space-y-3">
                <div className="space-y-2">
                  <Label>选择书源</Label>
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
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="输入书名搜索书城..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBookstoreSearch()}
                    disabled={!selectedSourceId}
                  />
                  <Button onClick={handleBookstoreSearch} disabled={!selectedSourceId || !searchQuery.trim()}>搜索</Button>
                </div>
                
                {bookstoreBooks.length > 0 && (
                  <div className="space-y-2">
                    <Label>选择书籍</Label>
                    <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                      {bookstoreBooks.map((book, idx) => (
                        <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input 
                            type="radio" 
                            name="bookstore-book" 
                            checked={selectedBookstoreBook === book.detailUrl} 
                            onChange={() => { 
                              setSelectedBookstoreBook(book.detailUrl); 
                              loadBookstoreChapters(book.detailUrl, selectedSourceId); 
                            }} 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{book.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{book.author || ''}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedBookstoreBook && (
                  <div className="space-y-2">
                    <Label>选择章节（可多选）</Label>
                    {isLoadingBookstoreChapters ? (
                      <p className="text-sm text-muted-foreground text-center py-4">加载章节中...</p>
                    ) : bookstoreChapters.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">未找到章节</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto border rounded p-2 space-y-2">
                        {bookstoreChapters.map((ch, idx) => (
                          <label key={idx} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                            <input 
                              type="checkbox" 
                              className="mt-1" 
                              checked={selectedBookstoreChapterIds.includes(ch.url)} 
                              onChange={() => toggleBookstoreChapterSelection(ch.url)} 
                            />
                            <div className="flex-1 min-w-0">
                              <div className='font-medium truncate'>{ch.title}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* 串行处理进度显示 */}
            {processingTotal > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  处理进度
                  {isExtracting && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                </Label>
                <Progress value={(processingProgress / processingTotal) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {processingProgress} / {processingTotal} 章节
                  {processingCurrent && ` - ${processingCurrent}`}
                </p>
              </div>
            )}

            {/* 流式输出显示 */}
            {(isStreaming || streamingOutput) && !debugViewOnly && (
              <div className="mt-2">
                <Label className="flex items-center gap-2">
                  AI生成进度
                  {isStreaming && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                </Label>
                <div className="p-3 border rounded bg-muted/30 text-sm whitespace-pre-wrap break-words max-h-60 overflow-auto">
                  {streamingOutput || '正在连接AI...'}
                  {isStreaming && <span className="animate-pulse">▋</span>}
                </div>
              </div>
            )}

            {debugViewOnly && rawOutput && (
              <div className="mt-2">
                <Label>模型原始输出（仅调试显示）</Label>
                <div className="p-2 border rounded bg-muted/30 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
                  {rawOutput}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              <Button 
                onClick={handleAiExtract} 
                disabled={isExtracting || (extractMode === 'local' ? selectedChapterIds.length === 0 : selectedBookstoreChapterIds.length === 0)}
                className="relative"
              >
                {isExtracting ? '处理中...' : '开始提取'}
                {!canGenerate && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-grow my-4">
        {characters.length > 0 ? (
            <Accordion type="multiple" className="w-full px-1">
            {characters.map(character => (
                <AccordionItem value={character.id} key={character.id}>
                 <div className="flex items-center w-full pr-4">
                    <Switch
                        className="mt-4 ml-4"
                        checked={character.enabled}
                        onCheckedChange={checked => handleToggle(character.id, checked)}
                        onClick={e => e.stopPropagation()}
                    />
                    <AccordionTrigger className='font-headline'>
                        <span className="truncate">{character.name}</span>
                    </AccordionTrigger>
                </div>
                <AccordionContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap px-2">{character.description}</p>
                    <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(character)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive" onClick={() => handleDelete(character.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>
        ) : (
            <div className="text-center text-muted-foreground p-8">
                <p>还没有角色卡。</p>
                <p>点击上方按钮添加第一个吧！</p>
            </div>
        )}
      </ScrollArea>
    </div>
  );
}
