# dog写作引擎 - 架构分析文档

## 📋 项目概览

**项目名称**: dog写作引擎 (dog-Engine)  
**定位**: 面向网文作者与编辑团队的开源创作与阅读一体化引擎  
**技术栈**: Next.js 15 + TypeScript + Gemini AI + Tailwind CSS  
**核心特性**: 前端直调AI、在线书城、创作管理、AI率检测、可扩展服务端能力

---

## 🏗️ 系统架构

### 架构风格
- **混合架构**: 前后端分离 + 前端直调AI
- **渐进式增强**: 核心功能纯前端运行，服务端功能可选启用
- **微服务思想**: 书源解析、AI代理、图片反代等能力模块化

### 技术栈详解

#### 前端框架
- **Next.js 15.3.3**: App Router + SSR/CSR混合渲染
- **React 18.3.1**: UI组件库基础
- **TypeScript 5**: 类型安全保障

#### UI/UX层
- **Tailwind CSS 3.4**: 原子化CSS框架
- **shadcn/ui**: 基于Radix UI的组件库
  - 30+个UI组件 (Dialog, Accordion, Tabs等)
  - 完全可定制主题系统
- **Lucide React**: 图标库
- **设计理念**: 
  - 淡黄色主色调 (#FAF4C0) - 仿羊皮纸质感
  - Literata serif字体 - 复古文学感
  - 移动端优先设计

#### AI能力层
- **Gemini AI**: Google生成式AI
  - 前端直调 (Browser → Google API)
  - 可选服务端代理 (Genkit)
- **@genkit-ai**: AI flow编排框架
- **支持模型**: 
  - `gemini-2.5-flash` (快速响应)
  - `gemini-2.5-pro` (高质量输出)
  - 可动态列举用户可用模型

#### 数据存储
- **LocalStorage**: 主存储方案
  - 书籍数据 (`books-v1`)
  - AI配置 (`gemini-api-key`, `gemini-model`)
  - 书源配置 (`book-sources-v2`, `book-source-auth`)
- **Firebase** (可选): 社区功能持久化

#### 网络层
- **fetch API**: 原生HTTP客户端
- **https-proxy-agent**: 服务端代理支持
- **Cheerio**: HTML解析 (书源内容提取)
- **VM2**: 安全沙箱执行用户书源JS代码

---

## 📁 项目结构分析

```
dog-Engine/
├── src/
│   ├── app/                    # Next.js App Router页面
│   │   ├── page.tsx           # 首页 (功能导航中心)
│   │   ├── layout.tsx         # 全局布局
│   │   ├── api/               # API路由 (服务端逻辑)
│   │   │   ├── bookstore/     # 书城相关API
│   │   │   ├── community/     # 社区功能API
│   │   │   └── test-proxy/    # 代理测试
│   │   ├── books/[bookId]/    # 书籍详情 (动态路由)
│   │   ├── bookstore/         # 在线书城页面
│   │   ├── community/         # 创作社区
│   │   ├── review/            # 网文审稿
│   │   ├── settings/          # 书源管理
│   │   └── talent-test/       # 网文天赋测试
│   │
│   ├── components/            # React组件库
│   │   ├── Editor.tsx         # 核心编辑器组件 (1084行)
│   │   ├── ChapterManager.tsx # 章节管理
│   │   ├── WorldBookManager.tsx # 世界设定管理
│   │   ├── CharacterCardManager.tsx # 角色卡片管理
│   │   ├── DeconstructOutline.tsx # 细纲拆解
│   │   ├── GeminiSettings.tsx # AI配置UI
│   │   ├── AiDetector.tsx     # AI率检测
│   │   └── ui/                # shadcn/ui组件 (40+个)
│   │
│   ├── lib/                   # 核心业务逻辑库
│   │   ├── gemini-client.ts   # 前端直调Gemini (498行)
│   │   ├── book-source-utils.ts # 书源解析引擎 (1067行)
│   │   ├── book-source-rule-parser.ts # 规则解析器
│   │   ├── book-source-storage.ts # 书源存储
│   │   ├── jsonpath-parser.ts # JSON路径解析
│   │   ├── proxy-fetch.ts     # 代理工具
│   │   ├── types.ts           # TypeScript类型定义
│   │   └── actions/           # Server Actions
│   │
│   ├── ai/                    # AI能力模块
│   │   ├── genkit.ts          # Genkit配置
│   │   ├── dev.ts             # 开发入口
│   │   └── flows/             # AI流程定义
│   │       ├── generate-story-chapter.ts
│   │       ├── respond-to-prompt-in-role.ts
│   │       ├── review-manuscript.ts
│   │       ├── refine-chapter-with-world-info.ts
│   │       └── list-models.ts
│   │
│   ├── hooks/                 # React Hooks
│   │   ├── use-toast.ts       # Toast通知
│   │   ├── use-mobile.tsx     # 移动端检测
│   │   └── useLocalStorage.ts # LocalStorage Hook
│   │
│   └── data/
│       └── community-prompts.json # 社区提示词库
│
├── docs/                      # 项目文档
│   ├── blueprint.md           # 产品蓝图
│   ├── frontend-ai-guide.md   # 前端AI使用指南
│   ├── frontend-migration-summary.md
│   └── proxy-setup.md         # 代理配置文档
│
├── book_sources.json          # 书源配置文件
├── book_source_auth.json      # 书源认证配置
├── apphosting.yaml            # Firebase部署配置
└── next.config.ts             # Next.js配置
```

---

## 🔧 核心功能模块

### 1. AI写作助手 (Editor.tsx)

**职责**: 智能续写、改写、风格迁移、角色扮演

**核心能力**:
- 🤖 **角色扮演回复**: 基于角色卡片和世界观上下文
- 📝 **智能续写**: 支持连续对话，保留上下文
- 🎨 **风格迁移**: 可调节温度、输出长度
- 🔄 **上下文压缩**: 多章节内容自动压缩为剧情清单
- 🧠 **思维链**: 可选包含AI思考过程 (thinking budget)

**技术实现**:
```typescript
// 前端直调Gemini API
import { generateContent, generateContentStream } from '@/lib/gemini-client';

// 构建消息历史
const messages = [
  { role: 'user', parts: [{ text: systemPrompt }] },
  { role: 'model', parts: [{ text: '明白' }] },
  ...conversationHistory
];

// 流式生成
for await (const chunk of generateContentStream({
  contents: messages,
  model: selectedModel,
  config: { temperature, maxOutputTokens }
})) {
  // 实时追加到编辑器
}
```

**用户配置项** (LocalStorage):
- `gemini-api-key`: API密钥
- `gemini-model`: 默认模型
- `gemini-temperature`: 生成温度
- `gemini-max-tokens`: 最大输出长度
- `gemini-safety`: 安全过滤级别
- `gemini-debug`: 调试模式
- `gemini-timeout-ms`: 请求超时
- `gemini-retries`: 重试次数

---

### 2. 在线书城 (bookstore/)

**职责**: 多书源聚合、搜索、分类、阅读、导入

**书源解析架构**:
```
用户输入书源规则 (JSON)
      ↓
book-source-rule-parser.ts (解析CSS/JS/JSONPath混合规则)
      ↓
VM2沙箱安全执行 (隔离用户代码)
      ↓
Cheerio解析HTML
      ↓
提取结构化数据
      ↓
返回 BookstoreBook / BookstoreChapter
```

**支持的规则类型**:
- **CSS选择器**: `@css:.book-item@text`
- **JS代码**: `<js>document.title</js>`
- **JSON路径**: `$.data.books[*].title`
- **混合规则**: `@css:.cover@src##@js:baseUrl+result`
- **占位符**: `{{page}}`, `{{host()}}`, `{{source.xxx}}`
- **正则替换**: `replaceRegex`, `sourceRegex`

**关键文件**:
- `src/lib/book-source-utils.ts` (1067行): 
  - `fetchSearchResults()` - 搜索书籍
  - `fetchBookDetail()` - 获取详情
  - `fetchChapterContent()` - 获取章节内容
  - `parseRuleWithCssJs()` - 规则解析核心

**书源配置示例**:
```json
{
  "name": "示例书源",
  "url": "https://example.com",
  "search": {
    "url": "https://example.com/search?q={{key}}",
    "bookList": "@css:.book-item",
    "name": "@css:.title@text",
    "bookUrl": "@css:a@href"
  },
  "content": {
    "content": "@css:.chapter-content@html",
    "replaceRegex": "广告.*?结束//g"
  },
  "proxyBase": "https://proxy.example.com/fetch?url={url}"
}
```

**图片反代** (`/api/proxy-image`):
- 解决跨域和防盗链
- 自动添加 User-Agent 和 Referer
- 支持 per-source 代理基址

---

### 3. 创作管理系统

#### 3.1 章节管理 (ChapterManager.tsx)

**功能**:
- ✏️ 创建/删除/重命名章节
- 💾 草稿与成稿分离
- 🤖 AI仿写 (保持情节，改变表达)
- 📥 从书城导入
- 📤 导出TXT

**AI仿写流程**:
```
用户触发仿写 → 加载社区提示词 → 选择模型/Token数 
→ Gemini API生成 → 替换章节内容
```

#### 3.2 角色卡片管理 (CharacterCardManager.tsx)

**数据结构**:
```typescript
interface Character {
  id: string;
  name: string;
  description: string; // 详细设定
  enabled: boolean;    // 是否影响AI
}
```

**使用场景**:
- AI角色扮演对话
- 自动注入角色上下文
- 支持启用/禁用控制

#### 3.3 世界设定管理 (WorldBookManager.tsx)

**数据结构**:
```typescript
interface WorldSetting {
  id: string;
  keyword: string;      // 触发关键词
  description: string;  // 设定内容
  enabled: boolean;
}
```

**触发机制**:
- 用户输入包含关键词 → 自动注入相关设定
- 可批量启用/禁用
- 支持编辑和删除

#### 3.4 细纲拆解 (DeconstructOutline.tsx)

**职责**: 从正文提取剧情骨架

**工作流程**:
1. 输入完整章节内容
2. AI分析提取关键事件
3. 生成结构化细纲
4. 保存到 LocalStorage (`deconstruct-outline-result`)

---

### 4. AI率检测 (AiDetector.tsx)

**职责**: 检测文本AI生成概率

**集成方式**:
- 调用外部检测API
- 返回原始概率值
- 辅助质量把控

---

### 5. 社区功能 (community/)

**功能**:
- 📤 分享AI角色设定
- 💡 发现优秀提示词
- ❤️ 点赞和收藏
- 🔥 热门排行

**数据源**:
- `src/data/community-prompts.json` (本地)
- Firebase Firestore (可选云端同步)

---

## 🔐 安全与隐私

### 前端直调AI的优势
1. **隐私保护**: API Key仅存浏览器，不经过服务器
2. **成本优化**: 不消耗服务器带宽和算力
3. **低门槛**: 无需后端部署，静态站点即可运行

### 书源JS沙箱隔离
```typescript
// 使用VM2隔离用户提供的JS代码
const vm = new VM({ timeout: 3000 });
const result = vm.run(`
  ${userProvidedCode}
  module.exports = result;
`);
```

### 代理安全
- 环境变量配置 (`.env.local`)
- 密码脱敏打印
- 超时保护 (5-30秒)

---

## 🌐 网络架构

### 前端请求流
```
用户浏览器 → Gemini API (直连)
用户浏览器 → Next.js API Routes → 书源网站
用户浏览器 → /api/proxy-image → 图片反代
```

### 服务端可选代理
```
国内服务器 → HTTP_PROXY → 墙外API
```

**配置方式**:
```bash
# .env.local
GEMINI_API_KEY=your_key
HTTP_PROXY=http://127.0.0.1:7890
```

---

## 📦 数据模型

### 核心实体

#### Book (书籍)
```typescript
interface Book {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
  author?: string;
  cover?: string;
  category?: string;
  detailUrl?: string;  // 书城来源
  sourceId?: string;   // 书源ID
}
```

#### Chapter (章节)
```typescript
interface Chapter {
  id: string;
  title: string;
  content: string;     // 富文本
  url?: string;        // 书城章节URL
}
```

#### BookSource (书源)
```typescript
interface BookSourceRule {
  search?: { /* 搜索规则 */ };
  find?: { /* 发现规则 */ };
  bookInfo?: { /* 详情规则 */ };
  toc?: { /* 目录规则 */ };
  content?: { /* 内容规则 */ };
}

interface BookSource {
  name: string;
  url: string;
  sourceGroup?: string;
  ruleSearch: BookSourceRule['search'];
  ruleBookInfo: BookSourceRule['bookInfo'];
  // ... 其他规则
  proxyBase?: string;  // Per-source代理
  jsLib?: string;      // 全局JS库
  loginUrl?: string;   // 登录脚本
}
```

---

## 🚀 部署与运行

### 开发环境
```bash
npm install
npm run dev              # 启动前端 (端口9002)
npm run genkit:dev       # 启动Genkit开发工具
```

### 生产环境
```bash
npm run build
npm start
```

### Firebase部署
```bash
firebase deploy --only hosting
```

**配置文件**: `apphosting.yaml`

---

## 🎯 关键技术点

### 1. 前端AI客户端 (`gemini-client.ts`)

**核心函数**:
- `generateContent()`: 一次性生成
- `generateContentStream()`: 流式生成
- `listGeminiModels()`: 列举可用模型
- `hasApiKey()`: 检查密钥存在性

**高级特性**:
- ⏱️ 超时控制: `gemini-timeout-ms`
- 🔄 自动重试: `gemini-retries` (0-3次)
- 🛡️ 安全设置: 5类过滤器可关闭
- 📊 Token统计: `usageMetadata`

### 2. 书源解析引擎 (`book-source-utils.ts`)

**解析流程**:
```typescript
// 1. 提取服务器列表
const hosts = getHostsFromComment(source.comment, source.jsLib);

// 2. 创建VM沙箱
const sandbox = createSandbox(source, key, page, result);

// 3. 执行pre-process JS
if (rule.preUpdateJs) {
  vm.run(rule.preUpdateJs);
}

// 4. 解析CSS/JS混合规则
const data = parseRuleWithCssJs(html, rule.bookList, sandbox);

// 5. 应用正则替换
const cleaned = applyReplaceRegex(data, rule.replaceRegex);
```

**支持的书源特性**:
- ✅ 大灰狼书源格式 (encodedEndpoints Base64解码)
- ✅ Legado阅读书源格式
- ✅ 动态服务器切换
- ✅ 分页拼接
- ✅ Cookie/Header自定义

### 3. Next.js配置优化

```typescript
// next.config.ts
const config = {
  typescript: { ignoreBuildErrors: true },  // 快速迭代
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true  // 支持动态域名
  }
};
```

### 4. 代理与网络容错

**代理配置** (`proxy-fetch.ts`):
```typescript
const proxyUrl = process.env.HTTPS_PROXY || 
                 process.env.HTTP_PROXY || 
                 process.env.ALL_PROXY;

if (proxyUrl) {
  const agent = new HttpsProxyAgent(proxyUrl);
  // 配置fetch使用代理
}
```

**Per-source代理重写**:
```typescript
function rewriteViaProxyBase(url: string, proxyBase?: string) {
  if (proxyBase.includes('{url}')) {
    return proxyBase.replace('{url}', encodeURIComponent(url));
  }
  return `${proxyBase}/${encodeURIComponent(url)}`;
}
```

---

## 🧪 测试与调试

### Gemini调试模式
```javascript
// 浏览器控制台启用
localStorage.setItem('gemini-debug', '1');

// 查看详细日志
localStorage.setItem('gemini-timeout-ms', '60000'); // 增加超时
localStorage.setItem('gemini-retries', '3');        // 启用重试
```

### 书源测试
```
访问 /settings 页面 → 导入书源 → 点击测试按钮
```

### 代理测试
```
访问 /api/test-proxy → 查看代理连接状态
```

---

## 📊 性能优化

### 前端优化
1. **按需加载**: Next.js动态import
2. **图片优化**: Next/Image组件 (未启用优化以支持动态域名)
3. **LocalStorage缓存**: 书籍、书源、AI配置

### AI响应优化
1. **流式输出**: `generateContentStream()` 实时显示
2. **上下文压缩**: 多章节自动压缩为剧情清单
3. **Token控制**: 用户可调节 `maxOutputTokens`

### 书源解析优化
1. **并发请求**: Promise.all加载多书源
2. **超时保护**: VM2执行3秒超时
3. **错误恢复**: 单书源失败不影响其他书源

---

## 🔮 扩展性设计

### 插件化书源
- 用户可自定义书源规则 (JSON格式)
- 支持JS脚本扩展解析能力
- 社区共享书源库

### AI能力扩展
```typescript
// 新增AI流程示例
// src/ai/flows/custom-flow.ts
export const customFlow = ai.defineFlow({
  name: 'customFlow',
  inputSchema: z.object({ /* ... */ }),
  outputSchema: z.object({ /* ... */ }),
}, async (input) => {
  // 自定义AI逻辑
});
```

### 存储层抽象
```typescript
// 可替换为IndexedDB、云端存储
interface StorageAdapter {
  getBooks(): Promise<Book[]>;
  saveBook(book: Book): Promise<void>;
}
```

---

## 🐛 已知限制与注意事项

### 1. TypeScript严格模式
- 当前配置: `ignoreBuildErrors: true`
- 原因: 快速迭代，部分第三方库类型不完整

### 2. 图片优化禁用
- 配置: `images.unoptimized: true`
- 原因: 书城图片来自动态域名，无法预配置

### 3. VM2沙箱限制
- 同步网络请求使用 `child_process.execSync` (服务端)
- 浏览器环境需转换为异步实现

### 4. Gemini API限额
- 免费版: ~15次/分钟, 1500次/天
- 建议: 生产环境使用付费版

---

## 📝 开发规范

### 目录结构约定
- `src/app/`: 页面和API路由
- `src/components/`: 可复用组件
- `src/lib/`: 纯业务逻辑
- `src/ai/`: AI相关能力
- `src/hooks/`: React Hooks

### 命名规范
- 组件: PascalCase (Editor.tsx)
- 工具函数: camelCase (parseRule)
- 类型: PascalCase (BookSource)
- 常量: UPPER_SNAKE_CASE (DEFAULT_MODEL)

### Git提交规范
```
feat: 新增功能
fix: 修复bug
docs: 文档更新
refactor: 代码重构
style: 格式调整
perf: 性能优化
test: 测试相关
```

---

## 🎓 学习资源

### 关键文档
- `docs/blueprint.md`: 产品设计蓝图
- `docs/frontend-ai-guide.md`: 前端AI使用指南
- `docs/proxy-setup.md`: 代理配置详解
- `README.md`: 快速上手指南

### 外部依赖文档
- [Next.js 15](https://nextjs.org/docs)
- [Gemini API](https://ai.google.dev/docs)
- [Genkit](https://firebase.google.com/docs/genkit)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 🚧 未来规划

### 短期优化
- [ ] 完善TypeScript类型安全
- [ ] 增加单元测试覆盖
- [ ] 优化移动端体验
- [ ] 支持更多AI模型 (Claude, GPT-4等)

### 中期规划
- [ ] 云端同步 (Firebase全量集成)
- [ ] 协作编辑功能
- [ ] 版本控制与历史记录
- [ ] 导出为EPUB/MOBI格式

### 长期愿景
- [ ] 插件市场 (社区共享书源、AI提示词)
- [ ] 多人协作工作空间
- [ ] 数据分析与写作建议
- [ ] AI辅助营销文案生成

---

## 📞 贡献与支持

### 如何贡献
1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交Pull Request

### 问题反馈
- GitHub Issues: 提交bug报告或功能建议
- 邮件支持: [预留联系方式]

---

## 📄 许可证

本项目采用 [LICENSE](LICENSE) 文件中指定的开源许可证。

---

## 🙏 致谢

感谢以下开源项目和服务:
- Google Gemini AI
- Next.js团队
- shadcn/ui社区
- Radix UI
- Firebase
- 所有贡献者和用户

---

**最后更新**: 2025年10月6日  
**文档版本**: v1.0.0  
**维护者**: [dog-Engine团队]

---

*本文档旨在帮助开发者快速理解项目架构，如有疏漏欢迎补充。*
