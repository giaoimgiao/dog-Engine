'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Wand2, RotateCcw, PencilLine, X, Image as ImageIcon } from 'lucide-react';
import React from 'react';

export interface InlineAIToolbarProps {
  isOpen: boolean;
  selectedPreview?: string;
  loading?: boolean;
  className?: string;
  onExpandClick?: () => void; // AI扩写
  onRewriteClick?: () => void; // AI改写（意不变）
  onCustomClick?: () => void; // 自定义描写
  onImageClick?: () => void; // AI生图
  onClose?: () => void;
}

/**
 * 一个轻量级的内联AI工具栏。为了适配textarea，工具栏采用容器定位而非精准锚点。
 * 父组件可将其放在编辑区域右下角或顶部。
 */
export function InlineAIToolbar(props: InlineAIToolbarProps) {
  const {
    isOpen,
    selectedPreview,
    loading,
    className,
    onExpandClick,
    onRewriteClick,
    onCustomClick,
    onImageClick,
    onClose,
  } = props;

  if (!isOpen) return null;

  return (
    <Card
      className={cn(
        'pointer-events-auto shadow-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'rounded-xl px-3 py-2 flex items-center gap-2',
        'max-w-[92vw]',
        className,
      )}
      style={{
        zIndex: 40,
      }}
    >
      {/* 不再展示所选文本，保持简洁 */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={onExpandClick}>
          <Wand2 className="h-4 w-4 mr-1" /> AI扩写
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={onRewriteClick}>
          <RotateCcw className="h-4 w-4 mr-1" /> AI改写
        </Button>
        <Button size="sm" disabled={loading} onClick={onCustomClick}>
          <PencilLine className="h-4 w-4 mr-1" /> 自定义描写
        </Button>
        <Button size="sm" variant="secondary" disabled={loading} onClick={onImageClick}>
          <ImageIcon className="h-4 w-4 mr-1" /> AI生图
        </Button>
        <Button size="icon" variant="ghost" disabled={loading} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export default InlineAIToolbar;


