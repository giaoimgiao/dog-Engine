'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, LogIn, UserPlus, Send, Globe } from 'lucide-react';
import { communityLogin, communityRegister, getRemoteVisiblePrompts, getCommunityBase, communityLogin as login, getCommunityToken, setCommunityToken } from '@/lib/community-remote';
import { getCommunityBase as getBase, setCommunityBase as setBase } from '@/lib/community-remote';

export default function CommunityUploadPage() {
  const { toast } = useToast();
  const [base, setBaseState] = useState('http://47.95.220.140:8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [visible, setVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedBase = getBase();
    const savedToken = getCommunityToken();
    if (savedBase) setBaseState(savedBase);
    if (savedToken) setToken(savedToken);
  }, []);

  const handleSaveBase = () => {
    setBase(base);
    toast({ title: '已保存服务器地址', description: base });
  };

  async function handleRegister() {
    setIsAuthLoading(true);
    try {
      const res = await communityRegister({ username, password, base });
      if (res.success) toast({ title: '注册成功', description: '请继续登录' });
      else toast({ title: '注册失败', description: res.message || '请稍后重试', variant: 'destructive' });
    } finally { setIsAuthLoading(false); }
  }

  async function handleLogin() {
    setIsAuthLoading(true);
    try {
      const res = await communityLogin({ username, password, base });
      if (res.success && res.token) { setToken(res.token); toast({ title: '登录成功' }); }
      else toast({ title: '登录失败', description: res.message || '请检查账户密码', variant: 'destructive' });
    } finally { setIsAuthLoading(false); }
  }

  async function handlePublish() {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/community/forward', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/api/community/prompts', method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, payload: { name, prompt, visible } })
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: '发布成功', description: '你的提示词已上传到社区' });
      setName(''); setPrompt(''); setVisible(true);
    } catch (e: any) {
      toast({ title: '发布失败', description: String(e?.message || e), variant: 'destructive' });
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background/80">
      <Header />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">社区快速上传</h1>
            <p className="text-muted-foreground text-sm">发布到你的公网服务器，所有运行本项目的用户都能自动获取</p>
          </div>
          <Button asChild variant="outline"><Link href="/community">返回社区</Link></Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5"/> 服务器与登录</CardTitle>
            <CardDescription>默认服务器：47.95.220.140。首次发布需注册并登录。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="base">服务器地址</Label>
                <Input id="base" value={base} onChange={(e) => setBaseState(e.target.value)} placeholder="http://47.95.220.140:8080" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSaveBase} variant="secondary" className="w-full">保存</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRegister} variant="outline" disabled={isAuthLoading}><UserPlus className="h-4 w-4 mr-1" /> 注册</Button>
              <Button onClick={handleLogin} disabled={isAuthLoading}><LogIn className="h-4 w-4 mr-1" /> 登录</Button>
              <div className="text-xs text-muted-foreground flex items-center">{token ? '已登录' : '未登录'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>发布提示词</CardTitle>
            <CardDescription>填写名称与内容，点击发布后将上传到社区</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：硬核科幻风格卡" />
            </div>
            <div className="space-y-2">
              <Label>提示词</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={10} placeholder="详细描述角色设定/风格卡内容" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="visible" checked={visible} onCheckedChange={setVisible} />
              <Label htmlFor="visible">公开可见</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePublish} disabled={isSubmitting || !token || !name.trim() || !prompt.trim()}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Send className="h-4 w-4 mr-2"/>}
                发布
              </Button>
              {!token && <div className="text-xs text-red-500">请先登录后再发布</div>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


