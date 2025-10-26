# 代理配置指南

## 问题背景

在国内环境中，由于网络限制，Next.js后端无法直接访问Google Gemini API。即使配置了VPN或在命令行中设置了代理环境变量，Node.js的`fetch`和Genkit SDK也不会自动使用系统代理。

## 解决方案

项目已集成代理支持，你只需要配置环境变量即可。

### 第一步：安装依赖

依赖已经安装完成：
```bash
npm install https-proxy-agent undici
```

### 第二步：配置代理

在项目根目录创建 `.env.local` 文件（如果不存在），添加以下配置：

```bash
# Gemini API 密钥
GEMINI_API_KEY=your_gemini_api_key_here

# 代理配置 - 选择以下任一方式
HTTP_PROXY=http://127.0.0.1:7890
# 或
HTTPS_PROXY=http://127.0.0.1:7890
# 或
ALL_PROXY=http://127.0.0.1:7890
```

**常见代理端口：**
- Clash: `7890`
- V2rayN: `10809`
- Shadowsocks: `1080`

**如果代理需要认证：**
```bash
HTTP_PROXY=http://username:password@127.0.0.1:7890
```

### 第三步：启动项目

正常启动即可，无需额外配置：

```bash
npm run dev
```

启动后你会在控制台看到代理状态日志：
```
[Proxy] Using proxy: http://127.0.0.1:****
[Genkit Proxy] Using proxy: http://127.0.0.1:****
```

## 配置优先级

代理配置的优先级：
1. `HTTPS_PROXY` - HTTPS请求专用代理（优先级最高）
2. `HTTP_PROXY` - HTTP请求专用代理
3. `ALL_PROXY` - 统一代理配置（优先级最低）

## 测试代理连接

可以在后端代码中使用测试函数验证代理是否工作：

```typescript
import { testProxyConnection } from '@/lib/proxy-fetch';

const result = await testProxyConnection();
console.log(result);
// 输出: { success: true, message: 'Proxy connection successful', proxy: 'http://127.0.0.1:7890' }
```

## 技术实现

### 1. 直接fetch调用（如list-models.ts）

```typescript
import { getProxyFetch } from '@/lib/proxy-fetch';

const proxyFetch = getProxyFetch();
const response = await proxyFetch('https://api.example.com/data');
```

### 2. Genkit SDK调用（如genkit.ts）

Genkit插件会自动使用配置的代理：

```typescript
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = process.env.HTTP_PROXY;
const agent = new HttpsProxyAgent(proxyUrl);

googleAI({
  fetchOptions: { dispatcher: agent }
})
```

## 常见问题

### Q: 配置了代理还是连接超时？

**检查项：**
1. 确认代理软件正在运行
2. 确认代理端口号正确（查看代理软件设置）
3. 确认代理开启了"允许来自局域网的连接"
4. 检查`.env.local`文件是否在项目根目录
5. 重启Next.js开发服务器

### Q: 代理在浏览器可用，但后端还是不行？

Node.js环境与浏览器不同，**不会自动使用系统代理**。必须通过环境变量显式配置。

### Q: 我的VPN开启了全局模式还需要配置吗？

**需要**。即使VPN开启全局模式，Node.js也不会自动使用。必须配置环境变量。

### Q: 可以在命令行临时设置代理吗？

可以，但不推荐：

**Windows PowerShell:**
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"; npm run dev
```

**Windows CMD:**
```cmd
set HTTP_PROXY=http://127.0.0.1:7890 && npm run dev
```

**Linux/Mac:**
```bash
HTTP_PROXY=http://127.0.0.1:7890 npm run dev
```

推荐使用`.env.local`文件配置，更加持久和方便。

### Q: 部署到服务器怎么配置？

在服务器的环境变量中设置：

```bash
# 编辑 ~/.bashrc 或 ~/.zshrc
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 或在系统服务配置中设置
# /etc/systemd/system/yourapp.service
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:7890"
Environment="HTTPS_PROXY=http://127.0.0.1:7890"
```

### Q: Google服务器上不需要代理，会受影响吗？

不会。如果不配置`HTTP_PROXY`环境变量，代码会自动使用直连模式，不会有任何影响。

## 安全提示

1. **不要提交 `.env.local` 到Git仓库**（已在`.gitignore`中）
2. 如果代理需要认证，密码会在日志中被隐藏（显示为`****`）
3. 生产环境建议使用更安全的密钥管理方案

## 验证成功

如果配置成功，你应该能看到：
- ✅ 控制台显示代理日志
- ✅ AI模型列表正常加载
- ✅ Genkit相关功能正常工作
- ✅ 不再出现`Connect Timeout Error`

如果仍有问题，请检查代理软件日志，确认连接请求是否到达代理服务器。

