'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyRound, Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCommunityBase, setCommunityBase, getCommunityToken, setCommunityToken, clearCommunityToken, communityLogin, communityRegister } from '@/lib/community-remote';

// 预设的服务器端口选项
const SERVER_PORTS = [
  { value: '8080', label: '8080 (默认)' },
  { value: '8880', label: '8880' },
  { value: '9990', label: '9990' },
];

export default function CommunityServerSettings() {
  const [open, setOpen] = useState(false);
  const [serverHost, setServerHost] = useState('47.95.220.140');
  const [serverPort, setServerPort] = useState('8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();
  
  // 组合完整的服务器地址
  const base = `http://${serverHost}:${serverPort}`;

  useEffect(() => {
    const savedBase = getCommunityBase();
    const savedToken = getCommunityToken();
    
    // 解析保存的服务器地址
    if (savedBase) {
      try {
        const url = new URL(savedBase);
        setServerHost(url.hostname);
        setServerPort(url.port || '8080');
      } catch {
        // 如果解析失败，使用默认值
        setServerHost('47.95.220.140');
        setServerPort('8080');
      }
    }
    
    setToken(savedToken);
  }, [open]);

  const handleSave = () => {
    setCommunityBase(base);
    toast({ title: '已保存服务器地址', description: base });
    setOpen(false);
  };

  const handleLogin = async () => {
    const res = await communityLogin({ username, password, base });
    if (res.success && res.token) {
      setToken(res.token);
      toast({ title: '登录成功' });
    } else {
      toast({ title: '登录失败', description: res.message || '请确认账号密码', variant: 'destructive' });
    }
  };

  const handleRegister = async () => {
    const res = await communityRegister({ username, password, base });
    if (res.success) {
      toast({ title: '注册成功', description: '请继续登录' });
    } else {
      toast({ title: '注册失败', description: res.message || '请稍后重试', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    clearCommunityToken();
    setToken(null);
    toast({ title: '已退出登录' });
  };

  const Trigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Server className="w-4 h-4" /> 服务器
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{Trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>社区服务器</DialogTitle>
          <DialogDescription>配置远程社区服务器地址并登录账户。默认服务器：47.95.220.140:8080</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serverHost">服务器IP</Label>
              <Input 
                id="serverHost" 
                value={serverHost} 
                onChange={(e) => setServerHost(e.target.value)} 
                placeholder="47.95.220.140" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverPort">端口</Label>
              <Select value={serverPort} onValueChange={setServerPort}>
                <SelectTrigger id="serverPort">
                  <SelectValue placeholder="选择端口" />
                </SelectTrigger>
                <SelectContent>
                  {SERVER_PORTS.map(port => (
                    <SelectItem key={port.value} value={port.value}>
                      {port.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            完整地址：{base}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{token ? <>已登录</> : <>未登录</>}</div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleRegister}><KeyRound className="w-4 h-4 mr-1" /> 注册</Button>
          {token ? <Button variant="destructive" onClick={handleLogout}>退出</Button> : <Button onClick={handleLogin}>登录</Button>}
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


