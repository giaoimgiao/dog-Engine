'use client';

import { useState, useEffect, useOptimistic } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, Plus, Loader2, Copy, Send, KeyRound, Eye, EyeOff } from 'lucide-react';
import { getVisiblePrompts, addPrompt, likePrompt } from '@/lib/actions/community';
import { getRemoteVisiblePrompts, addRemotePrompt, likeRemotePrompt, deleteRemotePrompt, updateRemotePrompt } from '@/lib/community-remote';
import { deletePrompt, updatePrompt } from '@/lib/actions/community';
import { Server } from 'lucide-react';
import type { CommunityPrompt } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import copy from 'copy-to-clipboard';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

function PromptCard({ prompt, handleLike, onLocalDelete, onLocalEdit }: { prompt: CommunityPrompt; handleLike: (id: string) => void, onLocalDelete: (id: string) => void, onLocalEdit: (p: CommunityPrompt) => void }) {
    const { toast } = useToast();

    const handleCopy = () => {
        const textToCopy = `${prompt.prompt}`;
        copy(textToCopy);
        toast({
            title: '复制成功',
            description: '角色设定已复制到剪贴板，快去AI写作助手中使用吧！',
        });
    };

    return (
        <Card className="bg-card/80 flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline">{prompt.name}</CardTitle>
                <CardDescription className="line-clamp-3 text-sm">{prompt.prompt}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end">
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-4">
                    <span>{formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true, locale: zhCN })}</span>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={() => handleLike(prompt.id)}>
                            <ThumbsUp className="h-4 w-4" />
                            {prompt.likes}
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={handleCopy}>
                              <Copy className="h-4 w-4 mr-1" />
                              复制
                          </Button>
                          {/* 本地管理：编辑/删除 */}
                          <Button variant="destructive" size="sm" onClick={() => onLocalDelete(prompt.id)}>删除(本地)</Button>
                          <Button variant="secondary" size="sm" onClick={() => onLocalEdit(prompt)}>编辑(本地)</Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PublishDialog({ onPublished }: { onPublished: () => void }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    // 已不需要密码
    const [visible, setVisible] = useState(true);
  const [uploadToServer, setUploadToServer] = useState(false); // 默认本地，勾选后上传服务器
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handlePublish = async () => {
        setIsLoading(true);
    let success = false;
    let message: string | undefined = '';
    if (uploadToServer) {
      // 先尝试远程，失败回落本地
      const ok = await addRemotePrompt({ name, prompt, visible });
      success = ok.success;
      message = ok.message;
      if (!success) {
        const local = await addPrompt({ name, prompt, visible });
        success = local.success;
        message = local.message;
      }
    } else {
      // 仅本地
      const local = await addPrompt({ name, prompt, visible });
      success = local.success;
      message = local.message;
    }
        setIsLoading(false);

        if (success) {
            toast({ title: '发布成功！', description: '你的 AI 角色设定已在社区分享。' });
            setOpen(false);
            setName('');
            setPrompt('');
            setVisible(true);
            onPublished();
        } else {
            toast({ title: '发布失败', description: message || '请检查服务器设置或本地发布密码', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2" />
                    分享我的设定
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>分享你的 AI 角色设定</DialogTitle>
                    <DialogDescription>优秀的设定能激发无限灵感。分享给社区，让更多人看到你的创意！</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="name">角色名称</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：一个愤世嫉俗的侦探" />
                    </div>
                    <div>
                        <Label htmlFor="prompt">角色设定</Label>
                        <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="详细描述角色的性格、背景、说话方式等..." rows={5} />
                    </div>
                    <div>
                        {/* 远程发布已不需要发布密码 */}
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="visible-switch" checked={visible} onCheckedChange={setVisible} />
                        <Label htmlFor="visible-switch" className="flex items-center gap-1 cursor-pointer">{visible ? <><Eye className="h-4 w-4"/>公开分享</> : <><EyeOff className="h-4 w-4"/>仅自己可见</>}</Label>
                    </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="upload-server" checked={uploadToServer} onCheckedChange={setUploadToServer} />
                    <Label htmlFor="upload-server" className="cursor-pointer">上传到服务器（默认只保存到本地社区）</Label>
                  </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">取消</Button>
                    </DialogClose>
                    <Button onClick={handlePublish} disabled={isLoading || !name.trim() || !prompt.trim()}>
                        {isLoading ? <Loader2 className="animate-spin" /> : <Send className="mr-2" />}
                        发布
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function CommunityPage() {
    const [prompts, setPrompts] = useState<CommunityPrompt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [optimisticPrompts, setOptimisticPrompts] = useOptimistic(
        prompts,
        (state, { id, newLikes }: { id: string, newLikes: number }) => {
            return state.map(p => (p.id === id ? { ...p, likes: newLikes } : p));
        }
    );

    const fetchPrompts = async () => {
        setIsLoading(true);
        let data: CommunityPrompt[] = [];
        try {
            // 优先从远程服务获取
            const remote = await getRemoteVisiblePrompts();
            if (Array.isArray(remote) && remote.length >= 0) data = remote;
        } catch (e) {
            // 忽略远程错误，回退到本地
        }
        if (data.length === 0) {
            data = await getVisiblePrompts();
        }
        setPrompts(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPrompts();
    }, []);

    const handleLocalDelete = async (id: string) => {
        const res = await deletePrompt(id);
        if (res.success) {
            setPrompts(prompts.filter(p => p.id !== id));
        }
    };

    const handleLocalEdit = async (p: CommunityPrompt) => {
        const name = window.prompt('编辑名称', p.name);
        if (name === null) return;
        const promptText = window.prompt('编辑提示词', p.prompt);
        if (promptText === null) return;
        await updatePrompt({ id: p.id, name, prompt: promptText });
        setPrompts(prompts.map(x => x.id === p.id ? { ...x, name, prompt: promptText } : x));
    };

    const handleLike = async (id: string) => {
        const currentPrompt = prompts.find(p => p.id === id);
        if (!currentPrompt) return;

        setOptimisticPrompts({ id, newLikes: currentPrompt.likes + 1 });
        let result = await likeRemotePrompt(id);
        if (!result.success) {
            result = await likePrompt(id);
        }
        if (result.success) {
            setPrompts(prompts.map(p => p.id === id ? {...p, likes: result.newLikes!} : p));
        }
    };
    
    return (
        <div className="flex flex-col min-h-screen bg-background/80">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold font-headline">创作社区</h1>
                        <p className="text-muted-foreground mt-1">发现和分享驱动故事的 AI 角色设定</p>
                        <Button asChild variant="outline" size="sm" className="gap-2">
                          <a href={`${process.env.NEXT_PUBLIC_COMMUNITY_SERVER || 'http://47.95.220.140:8080'}/upload`} target="_blank" rel="noopener noreferrer">
                            <Server className="w-4 h-4" /> 服务器
                          </a>
                        </Button>
                    </div>
                    <PublishDialog onPublished={fetchPrompts} />
                </div>

                {isLoading ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                           <Card key={i}>
                               <CardHeader>
                                   <Skeleton className="h-6 w-1/2 mb-2" />
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-full" />
                                   <Skeleton className="h-4 w-3/4" />
                               </CardHeader>
                               <CardContent>
                                   <div className="flex justify-between items-center mt-4">
                                       <Skeleton className="h-4 w-1/4" />
                                       <Skeleton className="h-9 w-28" />
                                   </div>
                               </CardContent>
                           </Card>
                        ))}
                    </div>
                ) : optimisticPrompts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {optimisticPrompts.map(prompt => (
                            <PromptCard key={prompt.id} prompt={prompt} handleLike={handleLike} onLocalDelete={handleLocalDelete} onLocalEdit={handleLocalEdit} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-lg">
                        <h2 className="text-xl font-semibold text-muted-foreground">社区空空如也</h2>
                        <p className="text-muted-foreground mt-2">点击“分享我的设定”，成为第一个吃螃蟹的人吧！</p>
                    </div>
                )}
            </main>
        </div>
    );
}
