'use client';

import type { Character, Chapter } from '@/lib/types';
import { useState } from 'react';
import { generateUUID } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
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
import { Plus, Trash2, Edit } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface CharacterCardManagerProps {
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  chapters?: Chapter[];
}

export default function CharacterCardManager({ characters, setCharacters, chapters = [] }: CharacterCardManagerProps) {
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Character | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [debugViewOnly, setDebugViewOnly] = useState(false);
  const [noLengthLimit, setNoLengthLimit] = useState(false);
  const [rawOutput, setRawOutput] = useState<string>('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingItem(null);
  };

  const handleSave = () => {
    if (!name.trim() || !description.trim()) return;

    if (editingItem) {
      const updated = characters.map(item =>
        item.id === editingItem.id ? { ...item, name, description } : item
      );
      setCharacters(updated);
    } else {
      const newItem: Character = {
        id: generateUUID(),
        name: name.trim(),
        description: description.trim(),
        enabled: true,
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

  const handleAiExtract = async () => {
    if (selectedChapterIds.length === 0) return;
    setIsExtracting(true);
    try {
      const selected = chapters.filter(ch => selectedChapterIds.includes(ch.id));
      const joinedRaw = selected.map(ch => `【${ch.title}】\n${ch.content || ''}`).join('\n\n');
      let joined = joinedRaw;
      if (!noLengthLimit) {
        // 压缩与限长（调试可关闭）
        const compact = joinedRaw
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
      const system = '你是资深的小说设定分析师。基于给定正文，抽取“角色卡”。每个角色包含：name（不超过10字），description（150-300字，包含身份、性格、动机与与主角关系）。以JSON数组返回，每项为{"name":"...","description":"..."}，不要输出其他内容。';
      const { getDefaultModel, generateContent } = await import('@/lib/gemini-client');
      const model = getDefaultModel();
      const opts = { systemInstruction: system, maxOutputTokens: 2048 } as const;
      if (debugViewOnly) {
        setRawOutput(`>>> INPUT LENGTH: ${joined.length}\n>>> SYSTEM LENGTH: ${system.length}\n>>> OPTIONS: ${JSON.stringify(opts)}\n\n`);
      }
      const output = await generateContent(model, joined, opts);

      const isDebug = () => {
        if (typeof window === 'undefined') return false;
        const v = localStorage.getItem('gemini-debug');
        return v === '1' || v === 'true' || v === 'on';
      };
      if (isDebug()) {
        // 打印模型原始输出，帮助定位解析问题
        // eslint-disable-next-line no-console
        console.debug('[AI Extract][raw]', output);
      }

      const tryParseArray = (text: string): Array<{ name: string; description: string }> => {
        // 1) 直接解析
        try { return JSON.parse(text.trim()); } catch {}
        // 2) 去掉三引号代码块（``` 或 ```json）
        try {
          const stripped = text
            .replace(/^```[a-zA-Z]*\s*/m, '')
            .replace(/```\s*$/m, '')
            .trim();
          return JSON.parse(stripped);
        } catch {}
        // 3) 提取第一个JSON数组
        try {
          const start = text.indexOf('[');
          const end = text.lastIndexOf(']');
          if (start !== -1 && end !== -1 && end > start) {
            const sub = text.substring(start, end + 1);
            return JSON.parse(sub);
          }
        } catch {}
        // 4) 提取对象并包裹成数组
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

      if (debugViewOnly) {
        setRawOutput(output);
        return;
      }

      const parsed = tryParseArray(output);
      const newCards: Character[] = (parsed || []).map((c) => ({ id: generateUUID(), name: String(c.name || '').slice(0, 20), description: String(c.description || ''), enabled: true }));
      if (newCards.length > 0) {
        setCharacters([...characters, ...newCards]);
        setIsAiDialogOpen(false);
        setSelectedChapterIds([]);
      }
    } catch (e: any) {
      console.error('AI 解析角色失败:', e);
      if (debugViewOnly) {
        const msg = String(e?.message || e || '');
        setRawOutput(prev => `${prev || ''}\n[ERROR]\n${msg}`);
        return;
      }
    } finally {
      setIsExtracting(false);
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
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              <Button onClick={handleSave}>{editingItem ? '保存更改' : '创建'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {chapters.length > 0 && (
          <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full mt-2">AI 自动获取</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>选择章节并通过 AI 自动提取角色</DialogTitle>
                <DialogDescription>勾选章节后，我们会把正文发送给 AI，自动生成角色卡。</DialogDescription>
              </DialogHeader>
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
              <div className="max-h-80 overflow-y-auto border rounded p-2 space-y-2">
                {chapters.map((ch) => (
                  <label key={ch.id} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={selectedChapterIds.includes(ch.id)} onChange={() => toggleChapterSelection(ch.id)} />
                    <div>
                      <div className='font-medium'>{ch.title}</div>
                      <div className='text-xs text-muted-foreground line-clamp-2'>{ch.content?.slice(0, 120) || ''}</div>
                    </div>
                  </label>
                ))}
              </div>
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
                <Button onClick={handleAiExtract} disabled={isExtracting || selectedChapterIds.length === 0}>{isExtracting ? '正在提取...' : '开始提取'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
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
