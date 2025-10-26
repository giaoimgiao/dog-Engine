'use client';

import type { WorldSetting } from '@/lib/types';
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

interface WorldBookManagerProps {
  worldSettings: WorldSetting[];
  setWorldSettings: (settings: WorldSetting[]) => void;
}

export default function WorldBookManager({ worldSettings, setWorldSettings }: WorldBookManagerProps) {
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorldSetting | null>(null);
  
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');

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
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              <Button onClick={handleSave}>{editingItem ? '保存更改' : '创建'}</Button>
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
