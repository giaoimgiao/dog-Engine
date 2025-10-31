'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Download, Eye, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ThemePluginManifest, THEME_TOKEN_KEYS } from '@/lib/theme-plugin';
import { generateUUID } from '@/lib/utils';

// 工具函数：HEX 转 HSL (返回 "H S% L%" 格式)
function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  return `${h} ${s}% ${l}%`;
}

// 工具函数：HSL 转 HEX
function hslToHex(hsl: string): string {
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return '#ffffff';
  let h = parseInt(match[1]) / 360;
  let s = parseInt(match[2]) / 100;
  let l = parseInt(match[3]) / 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface ThemeEditorProps {
  open: boolean;
  onClose: () => void;
  onSave?: (manifest: ThemePluginManifest) => void;
}

export default function ThemeEditor({ open, onClose, onSave }: ThemeEditorProps) {
  const { toast } = useToast();
  
  // Basic info
  const [themeName, setThemeName] = useState('我的主题');
  const [themeId, setThemeId] = useState('my-theme');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  
  // Global tokens
  const [editorBg, setEditorBg] = useState('#ffffff');
  const [editorFg, setEditorFg] = useState('#1f2937');
  const [editorAccent, setEditorAccent] = useState('#7c3aed');
  const [editorFontFamily, setEditorFontFamily] = useState('ui-sans-serif, system-ui');
  const [editorFontSize, setEditorFontSize] = useState(16); // px
  const [editorLineHeight, setEditorLineHeight] = useState(1.8);
  const [editorCaretColor, setEditorCaretColor] = useState('#7c3aed');
  
  // Scoped tokens (存储为 HEX，导出时转 HSL)
  const [topbarBgHex, setTopbarBgHex] = useState('#ffffff');
  const [topbarFgHex, setTopbarFgHex] = useState('#1f2937');
  const [topbarPrimaryHex, setTopbarPrimaryHex] = useState('#3b82f6');
  const [topbarBorderHex, setTopbarBorderHex] = useState('#e5e7eb');
  
  const [sidebarCardHex, setSidebarCardHex] = useState('#f3f4f6');
  const [sidebarCardFgHex, setSidebarCardFgHex] = useState('#1f2937');
  const [sidebarAccentHex, setSidebarAccentHex] = useState('#9ca3af');
  const [sidebarBorderHex, setSidebarBorderHex] = useState('#e5e7eb');
  
  const [editorScopeBgHex, setEditorScopeBgHex] = useState('#ffffff');
  const [editorScopeFgHex, setEditorScopeFgHex] = useState('#1f2937');
  
  const [actionbarBgHex, setActionbarBgHex] = useState('#f9fafb');
  const [actionbarBorderHex, setActionbarBorderHex] = useState('#e5e7eb');

  const buildManifest = (): ThemePluginManifest => {
    return {
      id: themeId || 'my-theme',
      name: themeName || '我的主题',
      version: '1.0.0',
      apiVersion: '0.1',
      permissions: ['theme'],
      theme: {
        tokens: {
          '--editor-bg': editorBg,
          '--editor-fg': editorFg,
          '--editor-accent': editorAccent,
          '--editor-font-family': editorFontFamily,
          '--editor-font-size': `${editorFontSize}px`,
          '--editor-line-height': String(editorLineHeight),
          '--editor-caret-color': editorCaretColor,
        }
      },
      scopes: {
        topbar: {
          '--background': hexToHSL(topbarBgHex),
          '--foreground': hexToHSL(topbarFgHex),
          '--primary': hexToHSL(topbarPrimaryHex),
          '--border': hexToHSL(topbarBorderHex),
        },
        sidebar: {
          '--card': hexToHSL(sidebarCardHex),
          '--card-foreground': hexToHSL(sidebarCardFgHex),
          '--accent': hexToHSL(sidebarAccentHex),
          '--border': hexToHSL(sidebarBorderHex),
        },
        editor: {
          '--background': hexToHSL(editorScopeBgHex),
          '--foreground': hexToHSL(editorScopeFgHex),
        },
        actionbar: {
          '--background': hexToHSL(actionbarBgHex),
          '--border': hexToHSL(actionbarBorderHex),
        }
      },
      author: author || undefined,
      description: description || undefined,
    };
  };

  const handleExport = () => {
    const manifest = buildManifest();
    const json = JSON.stringify(manifest, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${themeId || 'my-theme'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: '已导出主题', description: '主题文件已下载到本地' });
  };

  const handleSaveAndApply = () => {
    const manifest = buildManifest();
    if (onSave) {
      onSave(manifest);
      toast({ title: '已保存并应用', description: '主题已添加到列表并启用' });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            可视化主题编辑器
          </DialogTitle>
          <DialogDescription>
            在下方调整颜色、字体与布局，然后导出或直接应用到编辑器
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="theme-name">主题名称</Label>
                  <Input id="theme-name" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="我的主题" />
                </div>
                <div>
                  <Label htmlFor="theme-id">主题 ID（英文）</Label>
                  <Input id="theme-id" value={themeId} onChange={(e) => setThemeId(e.target.value)} placeholder="my-theme" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="author">作者</Label>
                  <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="你的名字" />
                </div>
                <div>
                  <Label htmlFor="description">描述</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="主题简介" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 编辑器样式 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">编辑器文本样式</CardTitle>
              <CardDescription>控制编辑区域的字体、颜色与排版</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="editor-bg">背景色</Label>
                  <div className="flex gap-2">
                    <Input type="color" id="editor-bg" value={editorBg} onChange={(e) => setEditorBg(e.target.value)} className="w-16 h-9 p-1" />
                    <Input value={editorBg} onChange={(e) => setEditorBg(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editor-fg">文字颜色</Label>
                  <div className="flex gap-2">
                    <Input type="color" id="editor-fg" value={editorFg} onChange={(e) => setEditorFg(e.target.value)} className="w-16 h-9 p-1" />
                    <Input value={editorFg} onChange={(e) => setEditorFg(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editor-accent">强调色</Label>
                  <div className="flex gap-2">
                    <Input type="color" id="editor-accent" value={editorAccent} onChange={(e) => setEditorAccent(e.target.value)} className="w-16 h-9 p-1" />
                    <Input value={editorAccent} onChange={(e) => setEditorAccent(e.target.value)} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="editor-font-family">字体族</Label>
                  <Input id="editor-font-family" value={editorFontFamily} onChange={(e) => setEditorFontFamily(e.target.value)} placeholder="ui-sans-serif, system-ui" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="editor-font-size">字号: {editorFontSize}px</Label>
                    <Input 
                      id="editor-font-size" 
                      type="range" 
                      min="12" 
                      max="24" 
                      step="1" 
                      value={editorFontSize} 
                      onChange={(e) => setEditorFontSize(Number(e.target.value))} 
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editor-line-height">行高: {editorLineHeight.toFixed(1)}</Label>
                    <Input 
                      id="editor-line-height" 
                      type="range" 
                      min="1.0" 
                      max="2.5" 
                      step="0.1" 
                      value={editorLineHeight} 
                      onChange={(e) => setEditorLineHeight(Number(e.target.value))} 
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 区域配色 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">区域配色</CardTitle>
              <CardDescription>为顶栏、侧边栏、编辑区、操作栏等设置独立配色（会自动转换为 HSL 格式）</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="topbar">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="topbar">顶栏</TabsTrigger>
                  <TabsTrigger value="sidebar">侧栏</TabsTrigger>
                  <TabsTrigger value="editor">编辑区</TabsTrigger>
                  <TabsTrigger value="actionbar">操作栏</TabsTrigger>
                </TabsList>
                
                <TabsContent value="topbar" className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>背景色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={topbarBgHex} onChange={(e) => setTopbarBgHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={topbarBgHex} onChange={(e) => setTopbarBgHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label>文字颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={topbarFgHex} onChange={(e) => setTopbarFgHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={topbarFgHex} onChange={(e) => setTopbarFgHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>主色调（按钮等）</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={topbarPrimaryHex} onChange={(e) => setTopbarPrimaryHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={topbarPrimaryHex} onChange={(e) => setTopbarPrimaryHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label>边框颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={topbarBorderHex} onChange={(e) => setTopbarBorderHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={topbarBorderHex} onChange={(e) => setTopbarBorderHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sidebar" className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>背景色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={sidebarCardHex} onChange={(e) => setSidebarCardHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={sidebarCardHex} onChange={(e) => setSidebarCardHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label>文字颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={sidebarCardFgHex} onChange={(e) => setSidebarCardFgHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={sidebarCardFgHex} onChange={(e) => setSidebarCardFgHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>选中项颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={sidebarAccentHex} onChange={(e) => setSidebarAccentHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={sidebarAccentHex} onChange={(e) => setSidebarAccentHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label>边框颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={sidebarBorderHex} onChange={(e) => setSidebarBorderHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={sidebarBorderHex} onChange={(e) => setSidebarBorderHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="editor" className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>背景色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={editorScopeBgHex} onChange={(e) => setEditorScopeBgHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={editorScopeBgHex} onChange={(e) => setEditorScopeBgHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label>文字颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={editorScopeFgHex} onChange={(e) => setEditorScopeFgHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={editorScopeFgHex} onChange={(e) => setEditorScopeFgHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="actionbar" className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>背景色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={actionbarBgHex} onChange={(e) => setActionbarBgHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={actionbarBgHex} onChange={(e) => setActionbarBgHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label>边框颜色</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={actionbarBorderHex} onChange={(e) => setActionbarBorderHex(e.target.value)} className="w-16 h-9 p-1" />
                        <Input value={actionbarBorderHex} onChange={(e) => setActionbarBorderHex(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            导出 JSON
          </Button>
          {onSave && (
            <Button onClick={handleSaveAndApply}>
              <Eye className="mr-2 h-4 w-4" />
              保存并应用
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

