'use client';

import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ModelSelector from '@/components/ModelSelector';
import { Switch } from '@/components/ui/switch';
import { useAIConfig } from '@/hooks/useAIConfig';

export interface InlineAIPanelValues {
  providerId?: string;
  modelId?: string;
  prompt?: string;
  useChapterContext?: boolean;
  useRoleCards?: boolean;
  useWorldBook?: boolean;
}

export interface InlineAIPanelProps {
  open: boolean;
  title: string;
  defaultPrompt: string;
  chapterContext?: string;
  roleCardsText?: string;
  worldBookText?: string;
  onClose: () => void;
  onConfirm: (values: InlineAIPanelValues) => void;
}

export default function InlineAIPanel(props: InlineAIPanelProps) {
  const { open, title, defaultPrompt, onClose, onConfirm } = props;
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();

  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [useChapterContext, setUseChapterContext] = useState<boolean>(true);
  const [useRoleCards, setUseRoleCards] = useState<boolean>(true);
  const [useWorldBook, setUseWorldBook] = useState<boolean>(false);

  const values: InlineAIPanelValues = useMemo(() => ({
    providerId: selectedProviderId,
    modelId: selectedModelId,
    prompt,
    useChapterContext,
    useRoleCards,
    useWorldBook,
  }), [selectedProviderId, selectedModelId, prompt, useChapterContext, useRoleCards, useWorldBook]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>配置一次性的生成参数与上下文范围</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>模型选择</Label>
            <ModelSelector
              selectedProviderId={selectedProviderId}
              selectedModelId={selectedModelId}
              onProviderChange={setSelectedProvider}
              onModelChange={setSelectedModel}
              compact
              showLabels={false}
            />
          </div>
          <div className="space-y-2">
            <Label>提示词</Label>
            <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="为本次操作提供具体指令" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">使用当前章节全文作为上下文</div>
                <div className="text-xs text-muted-foreground">用于更精准的改写/扩写</div>
              </div>
              <Switch checked={useChapterContext} onCheckedChange={setUseChapterContext} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">关联角色卡</div>
                <div className="text-xs text-muted-foreground">把已启用的角色设定拼入上下文</div>
              </div>
              <Switch checked={useRoleCards} onCheckedChange={setUseRoleCards} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <div className="text-sm font-medium">关联世界书</div>
                <div className="text-xs text-muted-foreground">把已启用的世界设定拼入上下文</div>
              </div>
              <Switch checked={useWorldBook} onCheckedChange={setUseWorldBook} />
            </div>
            {/* 关联书引入选项已移除：按你的要求，改到世界书/角色卡弹窗内实现 */}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => onConfirm(values)}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


