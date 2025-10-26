'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

// 禁用静态生成，因为此页面需要读取 URL 查询参数
export const dynamic = 'force-dynamic';

function LoginHelperContent() {
  const searchParams = useSearchParams();
  const loginUrl = (searchParams && searchParams.get('url')) || '';
  const sourceId = (searchParams && searchParams.get('sourceId')) || '';
  const sourceName = (searchParams && searchParams.get('name')) || '书源';
  
  const [cookies, setCookies] = useState('');
  const [loginKey, setLoginKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoDetected, setAutoDetected] = useState('');
  const [proxyDetected, setProxyDetected] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // 尝试自动检测cookie（只能读取同域的）
    const detectCookies = () => {
      const allCookies = document.cookie;
      if (allCookies) {
        setAutoDetected(allCookies);
      }
    };
    
    detectCookies();
    
    // 每2秒检测一次
    const interval = setInterval(detectCookies, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // 监听来自书签工具的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[LoginHelper] 收到消息:', event.data);
      
      // 接收书签工具发送的cookie
      if (event.data && event.data.type === 'COOKIE_DETECTED' && event.data.cookie) {
        console.log('[LoginHelper] 书签工具检测到cookie:', event.data.cookie);
        setProxyDetected(event.data.cookie);
        setCookies(event.data.cookie);
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        notification.textContent = '✅ Cookie已自动获取！请点击"保存并返回"';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // 通过直接访问目标域名来触发浏览器发送cookie
  const detectViProxy = async () => {
    setIsDetecting(true);
    try {
      // 方法1: 直接fetch目标URL，浏览器会自动带上cookie（如果有的话）
      // 但是我们无法直接读取cookie（跨域限制）
      // 所以我们通过服务端代理来读取
      
      console.log('[LoginHelper] 尝试通过代理获取cookie...');
      
      // 先让浏览器访问一次登录页面，确保cookie被设置
      try {
        await fetch(loginUrl, { 
          mode: 'no-cors',  // 跨域模式
          credentials: 'include'  // 包含cookie
        });
        console.log('[LoginHelper] 已访问登录页面，cookie应该已设置');
      } catch (e) {
        console.log('[LoginHelper] 直接访问失败，继续尝试代理方法');
      }
      
      // 然后通过服务端API获取
      const response = await fetch(`/api/bookstore/get-cookies?url=${encodeURIComponent(loginUrl)}`);
      const data = await response.json();
      
      if (data.success && data.cookies) {
        setProxyDetected(data.cookies);
        setCookies(data.cookies);
        
        // 显示成功通知
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-bounce';
        notification.innerHTML = '<div class="font-bold">✅ 成功获取Cookie！</div><div class="text-sm">请点击"保存并返回"</div>';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
      } else {
        alert(`未能自动获取Cookie\n\n${data.tip || '请使用书签工具或手动复制'}`);
      }
    } catch (error) {
      console.error('[LoginHelper] 检测失败:', error);
      alert('自动检测失败\n\n请使用书签工具：\n1. 拖动"📌 拖我到书签栏"到书签栏\n2. 在登录页面点击该书签\n3. Cookie会自动复制并发送回来');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = cookies || autoDetected;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    const textToSave = cookies || autoDetected || proxyDetected;
    if (!sourceId) return;
    try {
      // 1) 保存到localStorage（保留原逻辑，供前端JS使用）
      if (textToSave) localStorage.setItem(`booksource_${sourceId}_cookies`, textToSave);
      if (loginKey) localStorage.setItem(`booksource_${sourceId}_登录key`, loginKey);

      // 2) 同步到后端，写入 book_source_auth.json
      const cookiesMap: Record<string, string> = {};
      try { const u = new URL(loginUrl); cookiesMap[u.origin] = textToSave; } catch {}
      const resp = await fetch(`/api/bookstore/auth?sourceId=${encodeURIComponent(sourceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesMap, tokens: { key: loginKey } })
      });
      const ok = await resp.json();
      if (!ok.success) throw new Error('保存登录信息失败');

      alert('登录信息已保存！请返回书城页面刷新。');
      window.close();
    } catch (e: any) {
      alert('保存失败：' + (e?.message || e));
    }
  };

  const handleOpenInNewTab = () => {
    window.open(loginUrl, '_blank');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{sourceName} - 登录辅助</CardTitle>
          <CardDescription>
            获取登录cookie以使用完整功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 简化说明 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-3 text-lg">🚀 三步搞定登录</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                <div>
                  <p className="font-medium text-blue-900">打开登录页并登录</p>
                  <p className="text-sm text-blue-700">点击下方按钮 → 完成登录</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                <div>
                  <p className="font-medium text-purple-900">自动获取Cookie</p>
                  <p className="text-sm text-purple-700">登录后点击"自动检测Cookie"按钮</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                <div>
                  <p className="font-medium text-green-900">保存完成</p>
                  <p className="text-sm text-green-700">点击"保存并返回"即可</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleOpenInNewTab} className="w-full h-14" size="lg">
              <ExternalLink className="mr-2 h-5 w-5" />
              <div className="text-left">
                <div className="font-bold">打开登录页</div>
                <div className="text-xs opacity-80">步骤1</div>
              </div>
            </Button>
            <Button onClick={detectViProxy} className="w-full h-14" size="lg" variant="outline" disabled={isDetecting}>
              {isDetecting ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  检测中...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  <div className="text-left">
                    <div className="font-bold">自动检测Cookie</div>
                    <div className="text-xs opacity-80">步骤2</div>
                  </div>
                </>
              )}
            </Button>
          </div>

          {/* 代理检测到的cookie */}
          {proxyDetected && (
            <div className="space-y-2">
              <Label className="text-green-600">✅ 自动检测到的Cookie</Label>
              <div className="p-3 bg-green-50 border border-green-200 rounded-md font-mono text-xs break-all">
                {proxyDetected}
              </div>
            </div>
          )}

          {/* 自动检测的cookie */}
          {autoDetected && !proxyDetected && (
            <div className="space-y-2">
              <Label>自动检测到的Cookie（当前域名）</Label>
              <div className="p-3 bg-gray-50 rounded-md font-mono text-xs break-all">
                {autoDetected}
              </div>
            </div>
          )}

          {/* 手动输入cookie */}
          <div className="space-y-2">
            <Label htmlFor="cookie-input">手动输入Cookie（从开发者工具复制）</Label>
            <Input
              id="cookie-input"
              type="text"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="粘贴cookie字符串..."
              className="font-mono text-xs"
            />
          </div>

          {/* 登录 key 手动输入（网站登录返回的 key） */}
          <div className="space-y-2">
            <Label htmlFor="key-input">登录 key（例如：Iq9uNEhOMuDFEWcu）</Label>
            <Input
              id="key-input"
              type="text"
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder="粘贴登录返回的 key"
              className="font-mono text-xs"
            />
          </div>

          {/* 保存按钮 */}
          <Button 
            onClick={handleSave} 
            className="w-full h-14" 
            size="lg"
            disabled={!cookies && !autoDetected && !proxyDetected}
          >
            <Check className="mr-2 h-5 w-5" />
            <div className="text-left">
              <div className="font-bold">保存并返回</div>
              <div className="text-xs opacity-80">步骤3</div>
            </div>
          </Button>
          
          {/* 书签工具 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm">
            <p className="font-semibold text-yellow-900 mb-2">⭐ 一键获取工具（推荐）</p>
            <p className="text-yellow-800 mb-3">
              将下面的按钮拖到浏览器书签栏，然后在登录页面点击它，即可自动获取Cookie！
            </p>
            <div className="flex items-center gap-2">
              <a
                href={`javascript:(function(){const c=document.cookie;if(c){alert('Cookie已复制到剪贴板！\\n\\n'+c);navigator.clipboard.writeText(c).then(()=>{window.opener&&window.opener.postMessage({type:'COOKIE_DETECTED',cookie:c},'*')});}else{alert('未检测到Cookie，请先登录！')}})()`}
                className="inline-block bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold py-2 px-4 rounded-lg hover:from-yellow-500 hover:to-orange-500 cursor-move select-none"
                onClick={(e) => {
                  e.preventDefault();
                  alert('请将此按钮拖动到浏览器的书签栏！\n\n拖动后，在登录页面点击书签即可自动获取Cookie。');
                }}
              >
                📌 拖我到书签栏
              </a>
              <span className="text-xs text-yellow-700">← 拖动到书签栏</span>
            </div>
          </div>
          
          {/* 备用方案 */}
          <details className="border rounded-md">
            <summary className="p-3 cursor-pointer font-medium text-sm hover:bg-gray-50">
              💡 书签工具不会用？点击查看传统方法
            </summary>
            <div className="p-4 space-y-3 bg-gray-50 text-sm">
              <p className="font-medium">传统手动方法：</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>在登录页面按<kbd className="bg-gray-200 px-2 py-1 rounded text-xs">F12</kbd></li>
                <li>切换到"控制台"标签</li>
                <li>输入：<code className="bg-gray-200 px-2 py-1 rounded text-xs">document.cookie</code></li>
                <li>复制输出结果，粘贴到上方输入框</li>
              </ol>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginHelperPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>登录辅助</CardTitle>
            <CardDescription>正在加载...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginHelperContent />
    </Suspense>
  );
}

