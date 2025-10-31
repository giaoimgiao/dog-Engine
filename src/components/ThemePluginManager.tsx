'use client';

import { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { THEME_PLUGINS_KEY, THEME_SELECTED_ID_KEY, ThemePluginManifest, validateThemePlugin, THEME_TOKEN_KEYS, applyThemeTokensToElement } from '@/lib/theme-plugin';
import { Plus, Upload, Trash2, Palette, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ThemeEditor from './ThemeEditor';

export default function ThemePluginManager() {
  const { toast } = useToast();
  const [themes, setThemes] = useLocalStorage<ThemePluginManifest[]>(THEME_PLUGINS_KEY, []);
  const [selectedId, setSelectedId] = useLocalStorage<string | null>(THEME_SELECTED_ID_KEY, null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [hoverPreviewTokens, setHoverPreviewTokens] = useState<Record<string, string> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const selectedTheme = useMemo(() => themes.find(t => t.id === selectedId) || null, [themes, selectedId]);
  const effectivePreviewTokens = hoverPreviewTokens || selectedTheme?.theme?.tokens || null;

  useEffect(() => {
    if (!previewRef.current) return;
    const cleanup = applyThemeTokensToElement(previewRef.current, effectivePreviewTokens || undefined);
    return cleanup;
  }, [effectivePreviewTokens]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('无法读取文件内容');
        const parsed = JSON.parse(text);
        const manifest = validateThemePlugin(parsed);
        setThemes(prev => {
          const exists = prev.some(t => t.id === manifest.id);
          const list = exists ? prev.map(t => (t.id === manifest.id ? manifest : t)) : [...prev, manifest];
          return list;
        });
        toast({ title: '已导入主题', description: manifest.name });
      } catch (err: any) {
        toast({ title: '导入失败', description: err?.message || 'JSON格式不正确', variant: 'destructive' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const removeTheme = (id: string) => {
    setThemes(prev => prev.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSaveFromEditor = (manifest: ThemePluginManifest) => {
    setThemes(prev => {
      const exists = prev.some(t => t.id === manifest.id);
      const list = exists ? prev.map(t => (t.id === manifest.id ? manifest : t)) : [...prev, manifest];
      return list;
    });
    setSelectedId(manifest.id);
    toast({ title: '主题已保存并应用', description: manifest.name });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Palette className="w-5 h-5"/>编辑器主题</h2>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          <Button variant="outline" onClick={() => setIsEditorOpen(true)}>
            <Pencil className="mr-2 h-4 w-4"/>
            创建主题
          </Button>
          <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2"/>导入主题</Button>
          <Button variant="ghost" onClick={() => { setSelectedId(null); setHoverPreviewTokens(null); toast({ title: '已恢复默认主题' }); }}>恢复默认</Button>
        </div>
      </div>

      {/* 预览区 */}
      <Card>
        <CardHeader>
          <CardTitle>悬停预览</CardTitle>
          <CardDescription>将鼠标悬停在下面的主题卡片上，实时预览效果；点击开关以应用。</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={previewRef as any}
            className="rounded-md border p-4"
            style={{
              background: 'var(--editor-bg)',
              color: 'var(--editor-fg)',
              fontFamily: 'var(--editor-font-family)',
              fontSize: 'var(--editor-font-size)',
              lineHeight: 'var(--editor-line-height)'
            }}
          >
            <p className="mb-3">在编辑器里，主题将影响字体、字号、行距与背景等视觉样式。</p>
            <Textarea
              readOnly
              value={"这是预览文本。The quick brown fox jumps over the lazy dog. 这是一段用于预览主题效果的示例文本。"}
              className="w-full resize-none border-0 focus:ring-0 focus-visible:ring-0 bg-transparent"
              style={{
                background: 'var(--editor-bg)',
                color: 'var(--editor-fg)',
                fontFamily: 'var(--editor-font-family)',
                fontSize: 'var(--editor-font-size)',
                lineHeight: 'var(--editor-line-height)',
                caretColor: 'var(--editor-caret-color)'
              }}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {themes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>还没有主题</CardTitle>
            <CardDescription>导入一个主题 JSON 文件来美化编辑器排版与字体。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {themes.map(theme => (
            <Card
              key={theme.id}
              className={selectedId === theme.id ? 'ring-1 ring-primary' : ''}
              onMouseEnter={() => setHoverPreviewTokens(theme.theme.tokens)}
              onMouseLeave={() => setHoverPreviewTokens(null)}
            >
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{theme.name}</CardTitle>
                  <CardDescription className="text-xs">v{theme.version} · {theme.author || '社区'}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={selectedId === theme.id} onCheckedChange={(checked) => setSelectedId(checked ? theme.id : null)} />
                  <Button variant="ghost" size="icon" className="text-destructive/80 hover:text-destructive" onClick={() => removeTheme(theme.id)}>
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="tokens">
                    <AccordionTrigger>查看主题 Tokens</AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(theme.theme.tokens, null, 2)}</pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 主题编辑器 */}
      <ThemeEditor 
        open={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveFromEditor}
      />
    </div>
  );
}


