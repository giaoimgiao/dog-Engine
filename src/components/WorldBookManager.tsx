'use client';

import type { WorldSetting, Book } from '@/lib/types';
import { useState, useEffect } from 'react';
import { generateUUID } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { useLocalStorage } from '@/hooks/useLocalStorage';
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

interface WorldBookManagerProps {
  worldSettings: WorldSetting[];
  setWorldSettings: (settings: WorldSetting[]) => void;
  currentBookId?: string; // 用于持久化与跨书导入
}

export default function WorldBookManager({ worldSettings, setWorldSettings, currentBookId }: WorldBookManagerProps) {
  const { toast } = require('@/hooks/use-toast');
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorldSetting | null>(null);
  
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  // 书架 - 供跨书关联
  const [books] = useLocalStorage<Book[]>('books', []);
  const [isPickOpen, setIsPickOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importBookId, setImportBookId] = useState<string>('');
  const [importItems, setImportItems] = useState<WorldSetting[]>([]);
  const [importSelected, setImportSelected] = useState<string[]>([]);

  const resetForm = () => {
    setKeyword('');
    setDescription('');
    setEditingItem(null);
  };

  const handleSave = () => {
    if (!keyword.trim() || !description.trim()) return;

    if (editingItem) {
      // Update existing item
      const updatedSettings = worldSettings.map(item =>
        item.id === editingItem.id ? { ...item, keyword, description } : item
      );
      setWorldSettings(updatedSettings);
    } else {
      // Add new item
      const newSetting: WorldSetting = {
        id: generateUUID(),
        keyword: keyword.trim(),
        description: description.trim(),
        enabled: true,
      };
      setWorldSettings([...worldSettings, newSetting]);
    }
    resetForm();
    setIsNewItemDialogOpen(false);
  };

  const handleEditClick = (setting: WorldSetting) => {
    setEditingItem(setting);
    setKeyword(setting.keyword);
    setDescription(setting.description);
    setIsNewItemDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setWorldSettings(worldSettings.filter(item => item.id !== id));
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setWorldSettings(
      worldSettings.map(item => (item.id === id ? { ...item, enabled } : item))
    );
  };

  // 按书ID持久化当前书的世界书，供“从其他书导入”使用；仅保存，不做任何自动导入
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && currentBookId) {
        window.localStorage.setItem(`worldSettings:${currentBookId}`, JSON.stringify(worldSettings));
      }
    } catch {}
  }, [worldSettings, currentBookId]);

  const loadImportItems = (bookId: string) => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`worldSettings:${bookId}`) : null;
      if (!raw) {
        setImportItems([]);
      } else {
        const arr: any[] = JSON.parse(raw);
        const items: WorldSetting[] = (Array.isArray(arr) ? arr : []).map((it: any) => ({
          id: generateUUID(),
          keyword: String(it?.keyword || ''),
          description: String(it?.description || ''),
          enabled: Boolean(it?.enabled),
        }));
        setImportItems(items);
      }
    } catch (e: any) {
      setImportItems([]);
    }
  };

  const importCommit = () => {
    const selected = importItems.filter(it => importSelected.includes(it.id));
    if (selected.length === 0) return;
    setWorldSettings([...worldSettings, ...selected.map(s => ({ ...s, id: generateUUID() }))]);
    setIsImportOpen(false);
    setImportBookId('');
    setImportItems([]);
    setImportSelected([]);
    toast?.toast?.({ title: '导入成功', description: `已导入 ${selected.length} 条设定` });
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
              添加新设定
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? '编辑设定' : '添加新设定'}</DialogTitle>
              <DialogDescription>
                创建或修改你的世界观设定。关键词用于关联，描述是具体内容。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="keyword">关键词</Label>
                <Input id="keyword" value={keyword} onChange={e => setKeyword(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="description">描述</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              {/* 关联功能改为“直接导入”，已在下方提供显眼入口 */}
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
              <DialogTitle>选择一本书以导入世界书</DialogTitle>
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
                  <Label>选择要导入的设定</Label>
                  <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
                    {importItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">该书暂无可导入设定</p>
                    ) : (
                      importItems.map(it => (
                        <label key={it.id} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={importSelected.includes(it.id)} onChange={() => setImportSelected(prev => prev.includes(it.id) ? prev.filter(id => id !== it.id) : [...prev, it.id])} />
                          <div>
                            <div className="font-medium">{it.keyword}</div>
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
      </div>

      <ScrollArea className="flex-grow my-4">
        {worldSettings.length > 0 ? (
            <Accordion type="multiple" className="w-full px-1">
            {worldSettings.map(setting => (
                <AccordionItem value={setting.id} key={setting.id}>
                <div className="flex items-center w-full pr-4">
                    <Switch
                        className="mt-4 ml-4"
                        checked={setting.enabled}
                        onCheckedChange={checked => handleToggle(setting.id, checked)}
                        onClick={e => e.stopPropagation()}
                    />
                    <AccordionTrigger className='font-headline'>
                        <span className="truncate">{setting.keyword}</span>
                    </AccordionTrigger>
                </div>
                <AccordionContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap px-2">{setting.description}</p>
                    <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(setting)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive" onClick={() => handleDelete(setting.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>
        ) : (
            <div className="text-center text-muted-foreground p-8">
                <p>还没有世界设定。</p>
                <p>点击上方按钮添加第一个吧！</p>
            </div>
        )}
      </ScrollArea>
    </div>
  );
}
