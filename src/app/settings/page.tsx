'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, ChangeEvent, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import { generateUUID } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BookSource, BookSourceRule } from '@/lib/types';
import { Plus, Trash2, Edit, Save, X, Book, Globe, Upload, Loader2, Bot, Settings, Palette } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { AIProviderSettings } from '@/components/AIProviderSettings';
import ThemePluginManager from '@/components/ThemePluginManager';

async function fetchSources(): Promise<BookSource[]> {
    try {
        const res = await fetch('/api/get-book-sources');
        if (!res.ok) return [];
        const data = await res.json();
        return data.sources || [];
    } catch (e) {
        return [];
    }
}

async function saveSources(sources: BookSource[]): Promise<boolean> {
    try {
        const res = await fetch('/api/save-book-sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources }),
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}


function BookSourceForm({ onSave, source, onCancel }: { onSave: (source: BookSource) => void; source?: BookSource | null, onCancel: () => void; }) {
  const [formData, setFormData] = useState<Partial<BookSource>>({
    name: source?.name || '',
    url: source?.url || '',
    group: source?.group || '',
    comment: source?.comment || '',
    exploreUrl: source?.exploreUrl || '',
    loginUrl: source?.loginUrl || '',
    loginUi: source?.loginUi || '',
    loginCheckJs: source?.loginCheckJs || '',
    coverDecodeJs: source?.coverDecodeJs || '',
    bookUrlPattern: source?.bookUrlPattern || '',
    header: source?.header || '',
    searchUrl: source?.searchUrl || '',
    rules: source?.rules || {},
  });

  const { toast } = useToast();
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleRuleChange = (section: keyof BookSourceRule, field: string, value: string) => {
    setFormData(prev => ({
        ...prev,
        rules: {
            ...prev.rules,
            [section]: {
                ...prev.rules?.[section],
                [field]: value
            }
        }
    }));
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast({
        title: '错误',
        description: '书源名称不能为空。',
        variant: 'destructive',
      });
      return;
    }
    
    const finalData = { ...formData };
    
    // Convert rules from string back to object if needed
    if (typeof finalData.rules === 'string') {
        try {
            finalData.rules = JSON.parse(finalData.rules);
        } catch (e) {
            toast({ title: '解析规则错误', description: '解析规则(JSON)格式不正确', variant: 'destructive' });
            return;
        }
    }

    onSave({
      id: source?.id || generateUUID(),
      enabled: source?.enabled ?? true,
      ...finalData,
    } as BookSource);
  };
  
  const renderRuleInputs = (section: keyof BookSourceRule, fields: string[]) => {
    return fields.map(field => (
      <div key={`${section}-${field}`} className="space-y-1">
        <Label htmlFor={`${section}-${field}`} className="text-xs capitalize">{field.replace(/([A-Z])/g, ' $1')}</Label>
        <Textarea
          id={`${section}-${field}`}
          name={`${section}-${field}`}
          value={(formData.rules?.[section] as any)?.[field] || ''}
          onChange={(e) => handleRuleChange(section, field, e.target.value)}
          placeholder={`${section}.${field}`}
          className="text-sm font-mono"
          rows={field.toLowerCase().includes('url') || field.toLowerCase().includes('list') || field.toLowerCase().includes('js') || field.toLowerCase().includes('init') ? 3 : 1}
        />
      </div>
    ));
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
      <Accordion type="multiple" defaultValue={['basic']} className="w-full">
        <AccordionItem value="basic">
          <AccordionTrigger>源信息 (Basic)</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <div className='space-y-1'>
                <Label htmlFor="name">源名称 (name)</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} />
            </div>
             <div className='space-y-1'>
                <Label htmlFor="url">源标识 (url)</Label>
                <Input id="url" name="url" value={formData.url} onChange={handleInputChange} />
            </div>
             <div className='space-y-1'>
                <Label htmlFor="searchUrl">搜索地址 (searchUrl)</Label>
                <Textarea id="searchUrl" name="searchUrl" value={formData.searchUrl} onChange={handleInputChange} rows={3} className="font-mono"/>
            </div>
             <div className='space-y-1'>
                <Label htmlFor="exploreUrl">发现地址 (exploreUrl)</Label>
                <Textarea id="exploreUrl" name="exploreUrl" value={formData.exploreUrl} onChange={handleInputChange} rows={3} className="font-mono"/>
            </div>
             <div className='space-y-1'>
                <Label htmlFor="group">源分组 (group)</Label>
                <Input id="group" name="group" value={formData.group} onChange={handleInputChange} />
            </div>
            <div className='space-y-1'>
                <Label htmlFor="comment">源注释 (comment)</Label>
                <Textarea id="comment" name="comment" value={formData.comment} onChange={handleInputChange} className="font-mono"/>
            </div>
             <div className='space-y-1'>
                <Label htmlFor="loginUrl">登录URL (loginUrl)</Label>
                <Textarea id="loginUrl" name="loginUrl" value={formData.loginUrl} onChange={handleInputChange} rows={3} className="font-mono"/>
            </div>
            <div className='space-y-1'>
                <Label htmlFor="loginUi">登录UI (loginUi)</Label>
                <Textarea id="loginUi" name="loginUi" value={formData.loginUi} onChange={handleInputChange} rows={3} className="font-mono"/>
            </div>
            <div className='space-y-1'>
                <Label htmlFor="loginCheckJs">登录检查JS (loginCheckJs)</Label>
                <Textarea id="loginCheckJs" name="loginCheckJs" value={formData.loginCheckJs} onChange={handleInputChange} rows={3} className="font-mono"/>
            </div>
            <div className='space-y-1'>
                <Label htmlFor="coverDecodeJs">封面解密 (coverDecodeJs)</Label>
                <Textarea id="coverDecodeJs" name="coverDecodeJs" value={formData.coverDecodeJs} onChange={handleInputChange} rows={3} className="font-mono"/>
            </div>
             <div className='space-y-1'>
                <Label htmlFor="bookUrlPattern">书籍URL正则 (bookUrlPattern)</Label>
                <Input id="bookUrlPattern" name="bookUrlPattern" value={formData.bookUrlPattern} onChange={handleInputChange} className="font-mono"/>
            </div>
             <div className='space-y-1'>
                <Label htmlFor="header">请求头 (header)</Label>
                <Textarea id="header" name="header" value={formData.header} onChange={handleInputChange} rows={2} className="font-mono"/>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="search">
            <AccordionTrigger>搜索规则 (search)</AccordionTrigger>
            <AccordionContent className="space-y-2">
                {renderRuleInputs('search', ['checkKeyWord', 'bookList', 'name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'bookUrl'])}
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="find">
            <AccordionTrigger>发现规则 (find)</AccordionTrigger>
            <AccordionContent className="space-y-2">
                {renderRuleInputs('find', ['url', 'bookList', 'name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'bookUrl'])}
            </AccordionContent>
        </AccordionItem>
         <AccordionItem value="bookInfo">
            <AccordionTrigger>详情页规则 (bookInfo)</AccordionTrigger>
            <AccordionContent className="space-y-2">
                {renderRuleInputs('bookInfo', ['init', 'name', 'author', 'kind', 'wordCount', 'lastChapter', 'intro', 'coverUrl', 'tocUrl'])}
            </AccordionContent>
        </AccordionItem>
         <AccordionItem value="toc">
            <AccordionTrigger>目录规则 (toc)</AccordionTrigger>
            <AccordionContent className="space-y-2">
                {renderRuleInputs('toc', ['preUpdateJs', 'chapterList', 'chapterName', 'chapterUrl', 'formatJs', 'isVolume', 'updateTime', 'isVip', 'isPay'])}
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="content">
            <AccordionTrigger>正文规则 (content)</AccordionTrigger>
            <AccordionContent className="space-y-2">
                {renderRuleInputs('content', ['content', 'nextContentUrl', 'webJs', 'sourceRegex', 'replaceRegex', 'imageStyle', 'imageDecode', 'payAction'])}
            </AccordionContent>
        </AccordionItem>
      </Accordion>

       <DialogFooter className="sticky bottom-0 bg-background py-4">
          <Button variant="secondary" onClick={onCancel}>取消</Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </DialogFooter>
    </div>
  );
}

function SettingsPageInner() {
  const [sources, setSources] = useState<BookSource[]>([]);
  const [editingSource, setEditingSource] = useState<BookSource | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const {toast} = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const searchParams = useSearchParams();

  // Auth dialog states
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authSource, setAuthSource] = useState<BookSource | null>(null);
  const [cookieRows, setCookieRows] = useState<Array<{ domain: string; cookie: string }>>([{ domain: '', cookie: '' }]);
  const [tokenRows, setTokenRows] = useState<Array<{ key: string; value: string }>>([]);

  useEffect(() => {
    fetchSources().then(data => {
        setSources(data);
        setIsMounted(true);
    });
  }, []);
  
  // Auto-open auth dialog by query or when a source has loginUrl but no saved auth
  useEffect(() => {
    const wantAuthId = searchParams?.get('auth') || '';
    if (wantAuthId && sources.length > 0) {
      const s = sources.find(x => x.id === wantAuthId);
      if (s) openAuthDialog(s);
    }
  }, [searchParams, sources]);
  
  const updateAndSaveSources = async (newSources: BookSource[] | ((prev: BookSource[]) => BookSource[])) => {
      // 先计算新的书源列表
      const updatedSources = typeof newSources === 'function' ? newSources(sources) : newSources;
      
      console.log('📚 准备保存书源，数量:', updatedSources.length);
      
      // 先保存到服务器，等待完成
      const success = await saveSources(updatedSources);
      
      if (success) {
          console.log('✅ 书源保存成功');
          // 保存成功后更新状态
          setSources(updatedSources);
      } else {
          console.error('❌ 书源保存失败');
          toast({ 
              title: "保存失败", 
              description: "无法将书源更新写入服务器。请检查控制台错误信息。", 
              variant: "destructive" 
          });
          // 保存失败时重新加载服务器数据
          const serverSources = await fetchSources();
          setSources(serverSources);
      }
      
      return success;
  }

  const openAuthDialog = async (source: BookSource) => {
    setAuthSource(source);
    setIsAuthOpen(true);
    try {
      const res = await fetch(`/api/bookstore/auth?sourceId=${source.id}`);
      const data = await res.json();
      const cookiesMap: Record<string, string> = data?.auth?.cookies || {};
      const tokensMap: Record<string, string> = data?.auth?.tokens || {};
      const cRows = Object.keys(cookiesMap).length > 0
        ? Object.entries(cookiesMap).map(([domain, cookie]) => ({ domain, cookie }))
        : [{ domain: '', cookie: '' }];
      const tRows = Object.entries(tokensMap).map(([key, value]) => ({ key, value }));
      setCookieRows(cRows);
      setTokenRows(tRows);
    } catch (e) {
      setCookieRows([{ domain: '', cookie: '' }]);
      setTokenRows([]);
    }
  };

  const saveAuthDialog = async () => {
    if (!authSource) return;
    const cookies: Record<string, string> = {};
    cookieRows.forEach(r => {
      const d = r.domain.trim();
      const c = r.cookie.trim();
      if (d && c) cookies[d] = c;
    });
    const tokens: Record<string, string> = {};
    tokenRows.forEach(r => {
      const k = r.key.trim();
      const v = r.value.trim();
      if (k && v) tokens[k] = v;
    });
    const res = await fetch(`/api/bookstore/auth?sourceId=${authSource.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies, tokens })
    });
    if (res.ok) {
      toast({ title: '认证已保存', description: '后续请求将自动携带这些 Cookie/Token。' });
      setIsAuthOpen(false);
    } else {
      toast({ title: '保存失败', variant: 'destructive' });
    }
  };

  const addCookieRow = () => setCookieRows(prev => [...prev, { domain: '', cookie: '' }]);
  const removeCookieRow = (idx: number) => setCookieRows(prev => prev.filter((_, i) => i !== idx));
  const updateCookieRow = (idx: number, field: 'domain' | 'cookie', value: string) => setCookieRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const addTokenRow = () => setTokenRows(prev => [...prev, { key: '', value: '' }]);
  const removeTokenRow = (idx: number) => setTokenRows(prev => prev.filter((_, i) => i !== idx));
  const updateTokenRow = (idx: number, field: 'key' | 'value', value: string) => setTokenRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));


  const handleSaveSource = (source: BookSource) => {
    const isEditing = sources.some(s => s.id === source.id);
    if (isEditing) {
      updateAndSaveSources(sources.map(s => (s.id === source.id ? source : s)));
      toast({title: "书源已更新"});
    } else {
      updateAndSaveSources([...sources, source]);
      toast({title: "书源已添加"});
    }
    setIsFormOpen(false);
    setEditingSource(null);
  };

  const handleDeleteSource = (id: string) => {
    updateAndSaveSources(sources.filter(s => s.id !== id));
    toast({title: "书源已删除", variant: 'destructive'});
  };
  
  const handleToggleSource = (id: string, enabled: boolean) => {
      updateAndSaveSources(sources.map(s => (s.id === id ? {...s, enabled} : s)));
  }
  
  const openEditForm = (source: BookSource) => {
    setEditingSource(source);
    setIsFormOpen(true);
  }
  
  const openNewForm = () => {
    setEditingSource(null);
    setIsFormOpen(true);
  }
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        setIsImporting(true);
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                throw new Error("无法读取文件内容。");
            }
            
            console.log('📖 开始解析导入的JSON文件');
            const importedData = JSON.parse(text);
            const newSources: BookSource[] = [];

            const processSource = (sourceData: any) => {
                 if (sourceData.bookSourceName && sourceData.bookSourceUrl) {
                    const newSource: BookSource = {
                        id: generateUUID(),
                        name: sourceData.bookSourceName,
                        url: sourceData.bookSourceUrl,
                        enabled: sourceData.enabled ?? true,
                        group: sourceData.bookSourceGroup,
                        comment: sourceData.bookSourceComment,
                        exploreUrl: sourceData.exploreUrl,
                        loginUrl: sourceData.loginUrl,
                        loginUi: sourceData.loginUi,
                        loginCheckJs: sourceData.loginCheckJs,
                        coverDecodeJs: sourceData.coverDecodeJs,
                        bookUrlPattern: sourceData.bookUrlPattern,
                        header: sourceData.header,
                        searchUrl: sourceData.searchUrl,
                        rules: {
                            search: sourceData.ruleSearch,
                            find: sourceData.ruleExplore,
                            bookInfo: sourceData.ruleBookInfo,
                            toc: sourceData.ruleToc,
                            content: sourceData.ruleContent,
                        }
                    };
                    return newSource;
                }
                return null;
            }

            if (Array.isArray(importedData)) {
                importedData.forEach(sourceData => {
                    const newSource = processSource(sourceData);
                    if(newSource) newSources.push(newSource);
                });
            } else {
                const newSource = processSource(importedData);
                if(newSource) newSources.push(newSource);
            }
            
            if(newSources.length > 0) {
                console.log(`🔄 准备导入 ${newSources.length} 个书源`);
                
                // 等待保存完成
                const success = await updateAndSaveSources(prevSources => [...prevSources, ...newSources]);
                
                if (success) {
                    toast({
                        title: '✅ 导入成功',
                        description: `成功导入 ${newSources.length} 个书源，已保存到服务器。`,
                    });
                } else {
                    toast({
                        title: '⚠️ 导入失败',
                        description: '书源保存到服务器失败，请重试。',
                        variant: 'destructive',
                    });
                }
            } else {
                 throw new Error("JSON文件格式不正确或不包含有效书源。");
            }

        } catch (error: any) {
            console.error("❌ Import failed:", error);
            toast({
                title: '导入失败',
                description: error.message || '请检查文件内容是否为正确的书源JSON格式。',
                variant: 'destructive',
            });
        } finally {
            setIsImporting(false);
            // Reset file input
            if(fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    reader.readAsText(file);
  };


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
              <Settings className="w-8 h-8"/>
              系统设置
            </h1>
          </div>
          
          <Tabs defaultValue="book-sources" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="book-sources" className="flex items-center gap-2">
                <Book className="w-4 h-4" />
                书源管理
              </TabsTrigger>
              <TabsTrigger value="ai-providers" className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI配置
              </TabsTrigger>
              <TabsTrigger value="editor-themes" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                编辑器主题
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="book-sources" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">书源管理</h2>
                <div className='flex gap-2'>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".json"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={handleImportClick}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2" />
                        导入书源
                      </>
                    )}
                  </Button>
                  <Dialog open={isFormOpen} onOpenChange={(open) => {
                      if(!open) setEditingSource(null);
                      setIsFormOpen(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={openNewForm}>
                        <Plus className="mr-2" />
                        添加书源
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                          <DialogTitle>{editingSource ? '编辑书源' : '添加新书源'}</DialogTitle>
                          <DialogDescription>
                              配置网络小说书源，用于搜索和导入书籍。
                          </DialogDescription>
                      </DialogHeader>
                       <BookSourceForm
                          onSave={handleSaveSource}
                          source={editingSource}
                          onCancel={() => setIsFormOpen(false)}
                       />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              <div className="space-y-2">
                {isMounted && sources.length > 0 ? (
                  sources.map(source => (
                    <Card key={source.id} className={!source.enabled ? 'opacity-50' : ''}>
                      <Accordion type="single" collapsible>
                        <AccordionItem value="item-1" className="border-b-0">
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <AccordionTrigger className="p-0 hover:no-underline">
                                  <div className="flex items-center gap-4 ">
                                    <Globe className="w-6 h-6 text-muted-foreground flex-shrink-0"/>
                                    <div className="overflow-hidden text-left">
                                        <p className="font-bold truncate">{source.name}</p>
                                        <p className="text-sm text-muted-foreground truncate">{source.url}</p>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                               <Switch
                                checked={source.enabled}
                                onCheckedChange={(checked) => handleToggleSource(source.id, checked)}
                               />
                           <Button variant="outline" size="sm" onClick={() => openAuthDialog(source)}>认证设置</Button>
                               <Button variant="ghost" size="icon" onClick={() => openEditForm(source)}>
                                   <Edit className="h-4 w-4"/>
                               </Button>
                               <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive" onClick={() => handleDeleteSource(source.id)}>
                                   <Trash2 className="h-4 w-4"/>
                               </Button>
                            </div>
                          </CardContent>
                          <AccordionContent>
                            <div className="px-4 pb-4">
                              <pre className="bg-muted/50 p-4 rounded-md text-xs overflow-x-auto">
                                {JSON.stringify(source.rules || { '无解析规则': true }, null, 2)}
                              </pre>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </Card>
                  ))
                ) : (
                     <div className="text-center py-20 border-2 border-dashed rounded-lg">
                        <h2 className="text-xl font-semibold text-muted-foreground">{isMounted ? "暂无书源" : "正在加载书源..."}</h2>
                        <p className="text-muted-foreground mt-2">{isMounted && "点击「添加书源」或「导入书源」来配置你的小说来源吧！"}</p>
                    </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="ai-providers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">AI模型配置</h2>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI提供商管理
                  </CardTitle>
                  <CardDescription>
                    配置和管理您的AI提供商，支持OpenAI、Gemini、Claude等多种服务。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AIProviderSettings
                    trigger={
                      <Button className="w-full">
                        <Settings className="w-4 h-4 mr-2" />
                        打开AI配置管理
                      </Button>
                    }
                    variant="default"
                    showStatus={true}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>使用说明</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">支持的AI提供商</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li><strong>Google Gemini</strong> - 免费额度丰富，支持长文本</li>
                      <li><strong>OpenAI GPT</strong> - 业界标准，质量稳定</li>
                      <li><strong>Anthropic Claude</strong> - 擅长长文本理解和创作</li>
                      <li><strong>其他兼容服务</strong> - 支持OpenAI API格式的服务</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">配置步骤</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>点击"打开AI配置管理"按钮</li>
                      <li>添加您的AI提供商配置</li>
                      <li>输入API密钥和相关信息</li>
                      <li>测试连接确保配置正确</li>
                      <li>在编辑器中选择对应的模型使用</li>
                    </ol>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      💡 提示：配置信息仅保存在您的浏览器本地，不会上传到服务器。
                      建议定期导出配置文件作为备份。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="editor-themes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>主题与排版</CardTitle>
                  <CardDescription>导入并启用社区主题，定制编辑器颜色与字体。</CardDescription>
                </CardHeader>
                <CardContent>
                  <ThemePluginManager />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Auth Dialog */}
      <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>认证设置 {authSource ? `- ${authSource.name}` : ''}</DialogTitle>
            <DialogDescription>
              为需要登录/带 Cookie 的书源配置 Cookie 和 Token。我们会在访问相应域名时自动附加。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <p className="text-sm font-medium mb-2">Cookies</p>
              <div className="space-y-2">
                {cookieRows.map((row, idx) => (
                  <div key={`cookie-${idx}`} className="grid grid-cols-5 gap-2 items-center">
                    <Input placeholder="域名或Origin，如 https://api.langge.cf" value={row.domain} onChange={(e) => updateCookieRow(idx, 'domain', e.target.value)} className="col-span-2"/>
                    <Input placeholder="Cookie 字符串，如 sessionid=...; other=..." value={row.cookie} onChange={(e) => updateCookieRow(idx, 'cookie', e.target.value)} className="col-span-3"/>
                    <Button variant="ghost" size="sm" onClick={() => removeCookieRow(idx)}>删除</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCookieRow}>添加Cookie</Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Tokens（可选）</p>
              <div className="space-y-2">
                {tokenRows.map((row, idx) => (
                  <div key={`token-${idx}`} className="grid grid-cols-5 gap-2 items-center">
                    <Input placeholder="Key" value={row.key} onChange={(e) => updateTokenRow(idx, 'key', e.target.value)} className="col-span-2"/>
                    <Input placeholder="Value" value={row.value} onChange={(e) => updateTokenRow(idx, 'value', e.target.value)} className="col-span-3"/>
                    <Button variant="ghost" size="sm" onClick={() => removeTokenRow(idx)}>删除</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTokenRow}>添加Token</Button>
              </div>
            </div>
            {authSource?.loginUrl && authSource.loginUrl.startsWith('http') && (
              <div className="text-sm text-muted-foreground">
                <Button variant="link" asChild>
                  <a href={authSource.loginUrl} target="_blank" rel="noreferrer">打开登录页面以获取 Cookie</a>
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">取消</Button>
            </DialogClose>
            <Button onClick={saveAuthDialog}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}
