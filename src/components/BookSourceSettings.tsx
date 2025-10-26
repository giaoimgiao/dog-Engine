'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Loader2 } from 'lucide-react';
import type { BookSource } from '@/lib/types';

interface LoginUiItem {
  name: string;
  type: 'button' | 'text' | 'password';
  action?: string;
  style?: {
    layout_flexGrow?: number;
    layout_flexBasisPercent?: number;
  };
}

interface BookSourceSettingsProps {
  source: BookSource;
  onSettingsChange?: () => void;
}

export function BookSourceSettings({ source, onSettingsChange }: BookSourceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loginUiItems, setLoginUiItems] = useState<LoginUiItem[]>([]);
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [message, setMessage] = useState('');
  const [loginKey, setLoginKey] = useState('');

  useEffect(() => {
    if (!source.loginUi) {
      return;
    }

    // 从服务端API获取解析好的loginUi
    fetch(`/api/bookstore/get-login-ui?sourceId=${source.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          setLoginUiItems(data.items);
          
          // 初始化文本输入框的值（从localStorage读取）
          const savedInputs: Record<string, string> = {};
          data.items.forEach((item: LoginUiItem) => {
            if (item.type === 'text') {
              const savedValue = localStorage.getItem(`booksource_${source.id}_${item.name}`);
              if (savedValue) {
                savedInputs[item.name] = savedValue;
              }
            }
          });
          setTextInputs(savedInputs);
        }
      })
      .catch(error => {
        console.error('[BookSourceSettings] Failed to fetch loginUi:', error);
      });
  }, [source]);

  const handleTextChange = (name: string, value: string) => {
    setTextInputs(prev => ({ ...prev, [name]: value }));
    // 保存到localStorage
    localStorage.setItem(`booksource_${source.id}_${name}`, value);
    // 如果是“手动填写番茄token(可不填)”，同步到后端 tokens.key
    if (name.includes('token') || name.includes('登录key') || name.includes('key')) {
      setLoginKey(value);
      fetch(`/api/bookstore/auth?sourceId=${encodeURIComponent(source.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: { key: value } })
      }).catch(() => {});
    }
  };

  const executeAction = async (action: string) => {
    setIsExecuting(true);
    setMessage('');
    
    try {
      console.log('[BookSourceSettings] 执行action:', action);
      
      // 构建执行环境
      const toastMessages: string[] = [];
      
      // Mock java对象，收集toast消息和处理浏览器打开
      const mockJava = {
        toast: (msg: string) => {
          console.log('[Mock] java.toast:', msg);
          toastMessages.push(String(msg));
        },
        longToast: (msg: string) => {
          console.log('[Mock] java.longToast:', msg);
          toastMessages.push(String(msg));
        },
        startBrowser: (url: string, title: string) => {
          console.log('[Mock] java.startBrowser:', url, title);
          window.open(url, '_blank');
          toastMessages.push(`打开：${title}`);
        },
        startBrowserAwait: (url: string, title: string) => {
          console.log('[Mock] java.startBrowserAwait:', url, title);
          
          // 如果是登录URL，使用登录辅助页面
          if (url.includes('/login') || title.includes('登录')) {
            const helperUrl = `/bookstore/login-helper?url=${encodeURIComponent(url)}&sourceId=${source.id}&name=${encodeURIComponent(source.name)}`;
            window.open(helperUrl, '_blank', 'width=1200,height=800');
            toastMessages.push(`打开登录辅助页面：${title}`);
          } else {
            window.open(url, '_blank');
            toastMessages.push(`打开：${title}`);
          }
        },
        androidId: () => null,
        deviceID: () => null,
        getCookie: (domain: string) => '',
        base64Encode: (str: string) => btoa(str),
      };
      
      const mockCookie = {
        getCookie: (url: string) => '',
        removeCookie: (domain: string) => {
          console.log('[Mock] cookie.removeCookie:', domain);
        }
      };
      
      const mockCache = {
        get: (key: string) => null,
        put: (key: string, value: any) => {
          console.log('[Mock] cache.put:', key, value);
        }
      };
      
      // 模拟source对象
      const mockSource = {
        getVariable: () => {
          // 从localStorage读取保存的参数
          const saved = localStorage.getItem(`booksource_${source.id}_variables`);
          return saved || '{}';
        },
        setVariable: (value: string) => {
          // 保存参数到localStorage
          localStorage.setItem(`booksource_${source.id}_variables`, value);
          console.log('[Mock] source.setVariable:', value);
        },
        getLoginInfoMap: () => {
          // 返回用户输入的文本框值
          return textInputs;
        }
      };
      
      // 从书源的jsLib和loginUrl中提取host数组
      const extractHost = () => {
        const combinedScript = `${source.comment || ''}\n${source.jsLib || ''}\n${source.loginUrl || ''}`;
        
        // 方法1: 查找 const host = [...]
        let match = combinedScript.match(/const\s+host\s*=\s*(\[[\s\S]*?\])/);
        if (match && match[1]) {
          try {
            return eval(match[1]);
          } catch (e) {
            console.error('Failed to parse host array:', e);
          }
        }
        
        // 方法2: 查找 encodedEndpoints
        match = combinedScript.match(/const\s+encodedEndpoints\s*=\s*\[([\s\S]*?)\];/);
        if (match && match[1]) {
          try {
            const base64Strings = match[1].match(/'([^']+)'/g) || [];
            return base64Strings
              .map(s => s.replace(/'/g, '').trim())
              .filter(s => s.length > 0)
              .map(b64 => atob(b64))
              .filter(h => h.startsWith('http://') || h.startsWith('https://'));
          } catch (e) {
            console.error('Failed to decode endpoints:', e);
          }
        }
        
        return [];
      };
      
      const host = extractHost();
      console.log('[BookSourceSettings] 提取到的host:', host);
      
      // 构建getArguments函数
      const getArguments = (open_argument: string, key: string) => {
        let args: any;
        try {
          args = JSON.parse(open_argument);
        } catch (e) {
          args = {};
        }
        
        const defaults: any = {
          media: '小说',
          server: host.length > 0 ? host[0] : '',
          source: '番茄',
          source_type: '男频',
          tone_id: '默认音色',
          sq_user_id: '0'
        };
        
        const finalArgs = { ...defaults, ...args };
        return key ? finalArgs[key] : finalArgs;
      };
      
      const getArgument = (key: string) => {
        const open_argument = mockSource.getVariable();
        return getArguments(open_argument, key);
      };
      
      const setArgument = (key: string, value: any) => {
        const open_argument = mockSource.getVariable();
        const args = getArguments(open_argument, '');
        args[key] = value;
        mockSource.setVariable(JSON.stringify(args));
        return JSON.stringify(args);
      };
      
      // 先加载书源的jsLib和loginUrl中定义的函数
      let helperFunctions = '';
      if (source.jsLib) {
        helperFunctions += source.jsLib + '\n';
      }
      if (source.loginUrl) {
        helperFunctions += source.loginUrl + '\n';
      }
      
      // 执行action（使用Function而不是eval，更安全）
      try {
        // 将所有代码合并执行
        const fullCode = `
          ${helperFunctions}
          ${action}
        `;
        
        const func = new Function(
          'java', 'cookie', 'cache', 'source', 'host', 
          'getArguments', 'getArgument', 'setArgument', 'String',
          fullCode
        );
        func(mockJava, mockCookie, mockCache, mockSource, host, 
             getArguments, getArgument, setArgument, String);
      } catch (e: any) {
        console.error('[BookSourceSettings] Action execution error:', e);
        toastMessages.push('执行失败: ' + e.message);
      }
      
      // 显示收集到的消息
      if (toastMessages.length > 0) {
        setMessage(toastMessages.join('\n'));
      } else {
        setMessage('操作完成');
      }
      
      if (onSettingsChange) {
        onSettingsChange();
      }
    } catch (error) {
      setMessage('操作失败：' + (error as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  const renderButton = (item: LoginUiItem, index: number) => {
    const flexBasis = item.style?.layout_flexBasisPercent 
      ? `${item.style.layout_flexBasisPercent * 100}%` 
      : '100%';
    
    return (
      <Button
        key={index}
        variant="outline"
        style={{ flexBasis, flexGrow: item.style?.layout_flexGrow || 1 }}
        onClick={() => item.action && executeAction(item.action)}
        disabled={isExecuting}
        className="min-h-[44px]"
      >
        {item.name}
      </Button>
    );
  };

  const renderTextInput = (item: LoginUiItem, index: number) => {
    return (
      <div key={index} className="w-full">
        <Label htmlFor={`input-${index}`} className="text-sm">
          {item.name}
        </Label>
        <Input
          id={`input-${index}`}
          type={item.type === 'password' ? 'password' : 'text'}
          value={textInputs[item.name] || ''}
          onChange={(e) => handleTextChange(item.name, e.target.value)}
          placeholder={item.name}
          className="mt-1"
        />
      </div>
    );
  };

  if (!source.loginUi) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="书源设置">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source.name} - 书源设置</DialogTitle>
          <DialogDescription>
            配置书源参数、切换服务器、选择来源等
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
          <p className="font-semibold text-blue-900 mb-1">💡 登录说明</p>
          <p className="text-blue-700">
            点击"登录书源"会打开登录页面。登录后，请手动将token复制到下方的"手动填写番茄token"输入框中。
          </p>
        </div>
        
        {message && (
          <div className={`p-3 rounded-md text-sm ${
            message.includes('成功') || message.includes('✅') 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {message}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          {loginUiItems.length === 0 && (
            <div className="w-full text-center text-muted-foreground py-4">
              加载中...
            </div>
          )}
          {loginUiItems.map((item, index) => {
            if (item.type === 'button') {
              return renderButton(item, index);
            } else if (item.type === 'text' || item.type === 'password') {
              return renderTextInput(item, index);
            }
            return null;
          })}
        </div>
        
        {isExecuting && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>执行中...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

