



[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[![AI Providers](https://img.shields.io/badge/AI_Providers-7+-blueviolet?style=flat-square&logo=openai)](https://github.com/)
[![Multi-Model](https://img.shields.io/badge/Multi--Model-Supported-orange?style=flat-square&logo=google-gemini)](https://github.com/)
[![Config Import/Export](https://img.shields.io/badge/Config-Import%2FExport-success?style=flat-square&logo=json)](https://github.com/)
[![Reverse Engineering](https://img.shields.io/badge/Reverse-Engineering-red?style=flat-square&logo=hackthebox)](https://github.com/)

[功能特性](#-核心特性) • [快速开始](#-快速开始) • [技术架构](#-技术架构) • [核心技术](#-核心技术实现) • [文档](#-文档导航)

</div>

---
<img width="1907" height="921" alt="QQ20251017-193245" src="https://github.com/user-attachments/assets/78cd6370-2653-43a5-a7c8-044d2ba6d896" />

## 📖 项目简介

Dog写作引擎是一款专为网文作者打造的**开源全栈创作平台**，基于 Next.js 15 + TypeScript 构建。它不仅仅是一个写作工具，更是一个集成了AI辅助创作、在线书城、智能分析、图片生成等多功能的**一站式创作生态系统**。

### 🎯 核心亮点

- 🎯 **统一AI客户端** - 支持7+AI服务商（Gemini、OpenAI、Claude、DeepSeek、Moonshot、智谱AI、自定义），一套代码兼容所有模型
- 📦 **配置导入导出** - 完整的Provider配置管理系统，JSON格式导入导出，支持批量配置和验证
- ⚡ **智能路由** - 自动选择最佳AI提供商，支持故障转移和负载均衡
- 🔍 **AI率检测（逆向工程）** - 通过逆向ailv.run API，实现免费的AI生成内容检测，精准返回原始概率值
- 🎨 **AI图片生成** - 集成豆包AI，支持SSE流式处理和批量生图
- 📚 **智能书城系统** - 多书源解析引擎，支持搜索、分类、详情、章节阅读，配备智能缓存
- 🤖 **AI小说仿写** - 完整的对话管理系统，支持消息编辑/删除、多行输入、上下文保持
- 🎭 **专业创作工具集** - 章节管理、角色卡片、世界设定、细纲拆解
- 📱 **移动端优化** - 响应式图墙布局，完美适配各种屏幕尺寸
- 💾 **多级缓存** - 智能缓存策略，减少90%重复请求
- 📊 **使用统计** - 实时追踪Token消耗、响应时间、提供商使用情况
<img width="1920" height="1020" alt="QQ20251017-193128" src="https://github.com/user-attachments/assets/821eb40a-e768-4b56-a290-dbce45815c29" />

---

## 🌟 核心特性

### 1. 💡 AI智能创作系统

#### 🎯 专业小说分析功能
- **仿写开头** - 深度分析写作技巧，生成类似风格的开头
- **剧情总结** - 智能提取故事线索和关键转折点
- **卖点分析** - 挖掘独特设定和吸引读者的核心元素
- **角色分析** - 深度解析主要角色性格特点和成长弧线
- **风格分析** - 分析作者文笔特色和叙事技巧

#### 💬 完整对话管理
- **消息编辑** - 鼠标悬停显示操作菜单，支持实时编辑
- **消息删除** - 灵活管理对话历史
- **一键清空** - 快速重置会话状态
- **多行输入** - Textarea支持，Enter换行，Ctrl+Enter发送
- **上下文保持** - 完整的对话历史管理，AI记住所有上下文
- **快捷键支持** - Esc取消编辑，Ctrl+Enter保存
<img width="1799" height="854" alt="QQ20251016-204546" src="https://github.com/user-attachments/assets/36dbd75b-0812-4fef-8953-08ce3e049465" />

#### 🔧 技术实现
```typescript
// 对话历史管理 - 章节内容作为系统上下文
const conversationHistory = [
  { role: 'system', content: chapterContext },
  ...messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))
];

// 直接调用Gemini API，无需后端
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  { method: 'POST', body: JSON.stringify({ contents: conversationHistory }) }
);
```

### 2. 🎨 AI图片生成引擎

#### 核心功能
- **SSE流式处理** - 实时显示生成进度
- **批量生图** - 一次生成多张图片
- **轮询机制** - 自动获取生成结果
- **图片管理** - 支持下载、链接复制
- **移动端适配** - 响应式网格布局

#### 技术架构
```typescript
// Next.js API路由 - 豆包API适配
export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // SSE流式推送
  writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  
  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

### 3. 📚 智能书城系统

#### 多书源解析引擎
- **搜索功能** - 跨书源智能搜索
- **分类浏览** - 按类型/标签筛选
- **热门推荐** - 实时热门书籍榜单
- **书籍详情** - 完整信息展示（封面、简介、作者、状态）
- **章节目录** - 智能解析完整目录
- **在线阅读** - 支持多页内容自动拼接

#### 智能缓存策略
```typescript
// 分级缓存系统
const CACHE_DURATIONS = {
  hot: 30 * 60 * 1000,      // 热门书籍：30分钟
  categories: 60 * 60 * 1000, // 分类列表：1小时
  search: 15 * 60 * 1000,     // 搜索结果：15分钟
  category: 20 * 60 * 1000,   // 分类页面：20分钟
  book: 30 * 60 * 1000,       // 书籍详情：30分钟
};

// 自动过期检测和清理
const cached = localStorage.getItem(cacheKey);
if (cached && Date.now() < cached.timestamp + cached.expiry) {
  return cached.data; // 命中缓存
}
```

#### 高级解析能力
- **JavaScript执行** - 支持 `<js>` 代码块动态解析
- **混合规则** - `@css` + `@js` 选择器组合
- **JSONPath** - 完整的JSONPath表达式支持
- **占位符替换** - `{{page}}`、`{{host()}}`、`{{source.xxx}}`
- **正则处理** - `replaceRegex`、`sourceRegex` 文本清洗
- **导航智能** - 双重导航系统（章节列表 + HTML提取）

### 4. 🎭 专业创作工具集

#### ChapterManager - 章节管理器
- 草稿与成稿分离管理
- 章节版本控制
- 批量导入/导出
- 字数统计与进度追踪

#### CharacterCardManager - 角色卡片系统
- 完整的人物档案管理
- 角色关系图谱
- 性格特征标签化
- AI辅助角色设定生成

#### WorldBookManager - 世界观管理
- 设定分类管理
- 知识库构建
- 时间线管理
- 设定冲突检测

#### DeconstructOutline - 细纲拆解
- 从正文智能提取细纲
- 自动生成剧情骨架
- 情节点标注
- 节奏分析

### 5. 🔍 AI率检测系统（逆向工程）

<img width="1919" height="930" alt="QQ20251017-193331" src="https://github.com/user-attachments/assets/b1f3fb93-fc35-4f04-b1d5-6626eaa5d7fa" />

#### 核心突破
- **逆向ailv.run API** - 通过抓包分析，完整复现AI检测服务
- **协议伪装** - 自动添加Origin、Referer、User-Agent模拟真实浏览器
- **原始概率值** - 返回未处理的AI概率和人类概率原始数据
- **实时检测** - 无需注册，免费使用

#### 技术实现
```typescript
// 逆向分析的API端点
const AILV_API_URL = 'https://a.ailv.run/analyze';

// 精心构造的请求头，绕过反爬虫
headers: {
  'Content-Type': 'application/json',
  'Origin': 'https://www.ailv.run',
  'Referer': 'https://www.ailv.run/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...'
}

// 返回原始检测结果
{
  avgAiProbability: 0.85,      // AI生成概率
  avgHumanProbability: 0.15    // 人类创作概率
}
```

**逆向过程**：
1. 抓包分析目标网站API请求
2. 提取关键请求头和payload格式
3. 封装为Next.js API路由
4. 添加错误处理和日志系统

### 6. 📱 响应式设计

#### 移动端图墙布局
```css
/* 响应式网格 */
grid-cols-3 (手机) 
→ grid-cols-4 (平板) 
→ grid-cols-5 (桌面) 
→ grid-cols-6 (大屏)
```

- **Hover效果** - 图片轻微放大动画
- **悬浮层** - 移动端hover显示详细信息
- **未读标识** - 红色小圆点提示
- **自适应间距** - 根据屏幕尺寸调整padding/gap

---

## 🛠 技术架构

### 前端技术栈

```
Next.js 15 (App Router + Pages Router混合)
├── React 18 (Hooks + Context)
├── TypeScript 5.0 (严格类型检查)
├── Tailwind CSS 3.0 (实用优先CSS)
├── shadcn/ui (高质量组件库)
├── Lucide React (现代图标系统)
└── LocalStorage (客户端持久化)
```

### AI能力层（统一AI客户端架构）

```
统一AI客户端 (UnifiedAIClient)
├── 多提供商支持
│   ├── Google Gemini (官方API)
│   ├── OpenAI (ChatGPT)
│   ├── Anthropic Claude
│   ├── DeepSeek (国产)
│   ├── Moonshot AI (月之暗面)
│   ├── 智谱AI (ChatGLM)
│   └── 自定义OpenAI兼容端点
│
├── 核心功能
│   ├── 自动路由 (智能选择最佳Provider)
│   ├── 统一调用接口 (generateContent/Stream)
│   ├── 连接测试 (testConnection)
│   ├── 模型列表获取 (listModels)
│   ├── 配置导入导出 (JSON格式)
│   └── 使用统计 (token计数、响应时间)
│
├── 高级特性
│   ├── 动态思考 (Gemini 2.5系列专用)
│   ├── 温度/Top-P/Top-K精细控制
│   ├── 自定义请求头 (绕过限制)
│   ├── 请求超时和重试
│   └── 错误分类处理 (配额、网络、认证)
│
└── 前端直调
    ├── 智能续写、改写
    ├── 角色扮演
    ├── 风格迁移
    └── 专业分析

豆包AI图片生成
├── 文生图
├── SSE流式处理
└── 批量生成

可选：服务端扩展
└── Genkit Flows (高级AI工作流)
```

### 书城解析引擎

```
多书源解析系统
├── HTML解析 (cheerio)
├── JavaScript执行 (Function构造器)
├── JSONPath解析 (自研解析器)
├── 正则处理 (replaceRegex/sourceRegex)
├── 占位符替换 ({{变量}}系统)
├── 分页拼接 (自动下一页)
├── 图片代理 (/api/proxy-image)
└── 认证管理 (Cookie/Token)
```

### 存储架构

```
多层存储策略
├── LocalStorage (用户设置、API密钥、缓存)
├── IndexedDB (大型数据、离线支持)
├── Firebase (可选云存储)
└── 文件系统 (书源配置JSON)
```

### API路由设计

```
/api/
├── bookstore/          # 书城系统
│   ├── search         # 搜索
│   ├── categories     # 分类列表
│   ├── hot           # 热门书籍
│   ├── category      # 分类页面
│   ├── book          # 书籍详情
│   ├── chapter       # 章节内容
│   └── ai-detector   # AI检测
├── ai-image/
│   └── generate      # 图片生成（SSE）
├── community/
│   └── forward       # 社区转发
├── proxy-image       # 图片代理
└── test-proxy        # 代理测试
```

---

## 🚀 快速开始

### 环境要求

- Node.js 18.0+
- npm 9.0+ 或 pnpm 8.0+

### 安装步骤

#### 1️⃣ 克隆项目

```bash
git clone https://github.com/your-username/dog-writing-engine.git
cd dog-writing-engine
```

#### 2️⃣ 安装依赖

```bash
npm install
# 或
pnpm install
```

#### 3️⃣ 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:9002` 🎉

### 首次配置

#### 🤖 配置AI提供商（推荐：统一AI配置）

**方式1：使用统一AI配置界面（推荐）**

1. 打开应用右下角的 **「AI配置」** 按钮
2. 点击「添加提供商」
3. 选择预设模板（Gemini / OpenAI / Claude / DeepSeek等）
4. 填写API密钥和配置信息
5. 点击连接测试，验证可用性
6. 保存并启用

**支持的AI服务商**：
- **Google Gemini** - 免费额度大，推荐 `gemini-2.5-flash`
- **OpenAI** - GPT-4 / GPT-3.5，需付费
- **DeepSeek** - 性价比极高，国产
- **Moonshot AI** - Kimi长文本，支持200k上下文
- **智谱AI** - ChatGLM，国产
- **Claude** - Anthropic出品，逻辑性强
- **自定义** - 任意OpenAI兼容端点

**配置管理功能**：
- ✅ 多Provider同时启用，自动故障转移
- ✅ 配置导出/导入（JSON格式）
- ✅ API密钥显示/隐藏/复制
- ✅ 连接测试（检测可用性和响应时间）
- ✅ 高级参数（温度、Top-P、Top-K）
- ✅ Gemini 2.5 专用：动态思考模式

**方式2：传统单一Gemini配置**

1. 打开应用右下角的 **「Gemini设置」** 按钮
2. 点击「获取API密钥」链接，跳转到 [Google AI Studio](https://aistudio.google.com/app/apikey)
3. 生成并复制API Key
4. 粘贴到应用的API Key输入框
5. 点击保存

**安全提示**：
- ✅ 密钥仅保存在浏览器 `localStorage`
- ✅ 不会上传到任何服务器
- ✅ 完全由你自己掌控

**Gemini免费配额**：
- 每分钟 15 次请求
- 每天 1500 次请求
- 推荐模型：`gemini-2.5-flash`（性价比最高）

#### 🎨 配置豆包AI（可选）

如需使用AI图片生成功能，在根目录创建 `.env.local`：

```bash
# 豆包AI配置
DOUBAO_API_URL=https://your-doubao-api-endpoint
DOUBAO_API_KEY=your_doubao_api_key
DOUBAO_MODEL_ID=your_model_id
```

获取方式：
1. 访问火山引擎控制台
2. 创建豆包AI应用
3. 复制相关凭证

详见：[docs/ai-image-setup.md](docs/ai-image-setup.md)

#### 🌐 配置代理（可选）

仅国内服务器需要，用于访问Google服务：

```bash
# .env.local
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

详见：[docs/proxy-setup.md](docs/proxy-setup.md)

---

## 📱 功能详解

### AI仿写工作区

**路径**：进入书城 → 选择书籍 → 阅读章节 → 点击「导入到创作」

**功能清单**：

| 功能 | 描述 | 快捷键 |
|------|------|--------|
| **仿写开头** | AI分析原文写作技巧并创作类似风格的开头 | - |
| **剧情总结** | 智能提取故事脉络和关键情节 | - |
| **卖点分析** | 分析吸引读者的核心元素 | - |
| **角色分析** | 深度解析角色性格和关系 | - |
| **写作风格** | 剖析作者的叙事技巧 | - |
| **自由对话** | 基于章节内容的任意提问 | - |
| **消息编辑** | 修改历史消息重新生成响应 | Ctrl+Enter 保存 |
| **消息删除** | 移除不需要的对话记录 | - |
| **清空会话** | 一键重置所有对话 | - |
| **多行输入** | 支持长文本输入和换行 | Ctrl+Enter 发送 |

**技术亮点**：
- 完整的对话历史管理，支持「继续」等上下文指令
- 实时消息编辑，无需刷新页面
- 智能构建章节上下文，AI理解小说结构
- Textarea自动高度调整（40px-120px）

### 在线书城

**路径**：底部导航 → 书城

**核心功能**：

#### 📊 首页
- **热门推荐** - 实时热门榜单，30分钟缓存
- **分类导航** - 快速进入各类型书籍
- **搜索入口** - 全站搜索支持

#### 🔍 搜索页面
- **智能搜索** - 支持书名、作者搜索
- **多书源** - 自动聚合多个书源结果
- **15分钟缓存** - 减少重复搜索请求

#### 📑 分类页面
- **类型筛选** - 玄幻、都市、言情等
- **排序方式** - 最新、最热、评分
- **20分钟缓存** - 快速加载

#### 📖 书籍详情
- **完整信息** - 封面、简介、作者、状态、更新时间
- **章节目录** - 完整章节列表，支持快速跳转
- **一键导入** - 导入章节到创作工作区
- **30分钟缓存** - 流畅浏览体验

#### 📄 章节阅读
- **字体调节** - 5级字体大小可调
- **行距调节** - 3级行距选择
- **智能导航** - 双重导航系统（章节列表优先 + HTML解析备用）
- **多页拼接** - 自动加载并拼接分页内容
- **进度显示** - 当前章节位置提示

**缓存状态显示**：
- 🟢 绿色圆点 + "缓存中" - 数据来自缓存
- 🔄 刷新按钮 - 手动刷新强制更新

### AI图片生成

**路径**：底部导航 → 生图

**功能特性**：
- **文字描述** - 输入你想要的画面描述
- **提示词示例** - 内置多个参考案例
- **实时进度** - SSE流显示生成状态
- **批量展示** - 一次生成多张图片
- **图片管理** - 下载、复制链接
- **响应式布局** - 移动端友好

**技术实现**：
```typescript
// SSE流式接收
const eventSource = new EventSource('/api/ai-image/generate');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'progress') {
    updateProgress(data.progress);
  } else if (data.type === 'image') {
    displayImage(data.url);
  }
};
```

### 创作管理

**路径**：底部导航 → 创作

**模块详解**：

#### 📝 章节管理器
```typescript
interface Chapter {
  id: string;
  title: string;
  content: string;
  draft?: string;      // 草稿版本
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

- 草稿/成稿分离
- 版本历史记录
- 批量操作（导出、删除）
- 字数统计和目标追踪

#### 👤 角色卡片管理
```typescript
interface Character {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  personality: string[];
  background: string;
  relationships: Relationship[];
}
```

- 完整人物档案
- 角色关系图谱
- AI辅助生成
- 标签化管理

#### 🌍 世界设定
```typescript
interface WorldBook {
  id: string;
  category: string;    // 地理、历史、魔法体系等
  name: string;
  description: string;
  tags: string[];
  relatedChapters: string[];
}
```

- 分类管理（地理、历史、魔法、科技）
- 知识库搜索
- 设定引用追踪
- 冲突检测

#### 🎬 细纲拆解
- AI智能提取剧情点
- 自动生成时间线
- 情节点标注（起、承、转、合）
- 节奏分析图表

---

## 🏗 项目结构

```
dog-writing-engine/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── ai-image/
│   │   │   │   └── generate/         # 豆包AI图片生成（SSE）
│   │   │   │       └── route.ts
│   │   │   └── bookstore/
│   │   │       └── ai-detector/      # AI率检测
│   │   │           └── route.ts
│   │   ├── bookstore/                # 书城页面
│   │   │   ├── page.tsx             # 主页（热门+分类）
│   │   │   ├── search/              # 搜索页面
│   │   │   ├── category/            # 分类页面
│   │   │   ├── book/                # 书籍详情
│   │   │   └── read/                # 章节阅读
│   │   ├── community/                # 社区功能
│   │   ├── review/                   # AI率检测
│   │   └── settings/                 # 设置页面
│   │
│   ├── components/                   # React组件
│   │   ├── AiDetector.tsx           # AI检测器
│   │   ├── GeminiSettings.tsx       # Gemini配置
│   │   ├── ChapterManager.tsx       # 章节管理
│   │   ├── CharacterCardManager.tsx # 角色管理
│   │   ├── WorldBookManager.tsx     # 世界观管理
│   │   ├── DeconstructOutline.tsx   # 细纲拆解
│   │   ├── Editor.tsx               # 富文本编辑器
│   │   ├── InlineAIPanel.tsx        # AI仿写面板
│   │   └── ui/                      # shadcn/ui组件库
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── textarea.tsx
│   │       └── ...                  # 35+组件
│   │
│   ├── lib/                         # 工具库
│   │   ├── gemini-client.ts        # Gemini API客户端
│   │   ├── book-source-utils.ts    # 书源解析引擎
│   │   ├── book-source-rule-parser.ts  # 规则解析器
│   │   ├── jsonpath-parser.ts      # JSONPath解析
│   │   ├── proxy-fetch.ts          # 代理请求工具
│   │   ├── idb-storage.ts          # IndexedDB封装
│   │   ├── clipboard-utils.ts      # 剪贴板工具
│   │   └── ai/                     # AI统一客户端
│   │       ├── unified-client.ts
│   │       ├── config-manager.ts
│   │       └── providers/          # 多AI提供商
│   │           ├── base.ts
│   │           ├── gemini.ts
│   │           └── openai-compatible.ts
│   │
│   ├── hooks/                       # React Hooks
│   │   ├── useAI.ts                # AI状态管理
│   │   ├── useAIConfig.ts          # AI配置管理
│   │   ├── useLocalStorage.ts      # 本地存储Hook
│   │   ├── use-mobile.tsx          # 移动端检测
│   │   └── use-toast.ts            # Toast通知
│   │
│   ├── pages/api/                   # Pages Router API
│   │   └── bookstore/
│   │       ├── search.ts           # 搜索API
│   │       ├── categories.ts       # 分类API
│   │       ├── hot.ts              # 热门API
│   │       ├── category.ts         # 分类页面API
│   │       ├── book.ts             # 书籍详情API
│   │       ├── chapter.ts          # 章节内容API
│   │       └── proxy-image.ts      # 图片代理API
│   │
│   ├── ai/                          # Genkit Flows（可选）
│   │   ├── genkit.ts
│   │   └── flows/
│   │       ├── generate-story-chapter.ts
│   │       ├── refine-chapter-with-world-info.ts
│   │       ├── respond-to-prompt-in-role.ts
│   │       └── review-manuscript.ts
│   │
│   └── data/                        # 静态数据
│       └── community-prompts.json
│
├── docs/                            # 文档
│   ├── ai-image-setup.md           # AI图片配置指南
│   ├── proxy-setup.md              # 代理配置
│   ├── frontend-ai-guide.md        # 前端AI指南
│   ├── legado-book-source-compatibility.md  # 书源兼容性
│   └── blueprint.md                # 项目蓝图
│
├── book_sources.json                # 书源配置
├── book_source_auth.json            # 书源认证
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 🎯 核心技术实现

### 1. 统一AI客户端系统（多模型供应商架构）

#### 🎨 架构设计理念

**问题场景**：
- 不同AI服务商API格式不一致（Gemini、OpenAI、Claude各有协议）
- 切换模型需要修改大量代码
- 配置管理混乱，密钥分散存储
- 无法统一监控使用情况

**解决方案**：设计统一AI客户端 (`UnifiedAIClient`)

#### 📦 核心组件

**1️⃣ 提供商抽象层** (`src/lib/ai/providers/base.ts`)
```typescript
// 统一的AI提供商接口
export interface AIProvider {
  readonly id: string;
  readonly type: 'openai' | 'gemini' | 'claude' | 'custom';
  readonly apiUrl: string;
  readonly apiKey: string;
  
  // 统一的调用方法
  generateContent(modelId: string, prompt: string, options?: GenerateOptions): Promise<string>;
  generateContentStream(modelId: string, prompt: string, options?: GenerateOptions): AsyncGenerator<string>;
  listModels(): Promise<AIModel[]>;
  testConnection(): Promise<ConnectionTestResult>;
}
```

**2️⃣ 具体实现**
- `GeminiProvider` - Google Gemini专用（支持动态思考）
- `OpenAICompatibleProvider` - OpenAI兼容（支持99%的AI服务）
- 自动检测：如果配置为Gemini但API地址非Google，自动降级为OpenAI兼容模式

**3️⃣ 统一客户端** (`src/lib/ai/unified-client.ts`)
```typescript
export class UnifiedAIClient {
  private providers = new Map<string, AIProvider>();
  
  // 生成内容 - 统一入口
  async generateContent(
    providerId: string,
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<string> {
    const provider = this.ensureProviderForCall(
      this.getProvider(providerId)
    );
    return provider.generateContent(modelId, prompt, options);
  }
  
  // 自动选择最佳提供商
  async selectBestProvider(): Promise<{ providerId: string; modelId: string }> {
    // 优先级：Gemini > OpenAI > Claude > Custom
    const enabledProviders = this.getEnabledProviders();
    // ... 智能选择逻辑
  }
  
  // 获取使用统计
  getStatsSummary(): {
    totalRequests: number;
    totalTokens: number;
    averageResponseTime: number;
    providerUsage: Record<string, number>;
  }
}
```

#### ⚙️ 配置管理系统 (`src/lib/ai/config-manager.ts`)

**功能清单**：
```typescript
export class AIConfigManager {
  // CRUD操作
  static addProvider(provider: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'>)
  static updateProvider(providerId: string, updates: Partial<AIProviderConfig>)
  static removeProvider(providerId: string)
  static getProviders(): AIProviderConfig[]
  
  // 导入导出
  static exportConfig(): string  // 导出JSON配置
  static importConfig(configJson: string, options: {
    overwrite?: boolean;    // 是否覆盖现有配置
    skipInvalid?: boolean;  // 跳过无效配置
  }): { success: boolean; imported: number; skipped: number; errors: string[] }
  
  // 验证
  static validateProvider(provider: AIProviderConfig): ConfigValidationResult
  
  // 健康检查
  static checkHealth(): { healthy: boolean; issues: Array<{ type: 'error' | 'warning'; message: string }> }
  
  // 配置变更监听
  static onConfigChange(callback: (event: ConfigChangeEvent) => void): () => void
}
```

**配置导出格式**：
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-01-20T10:30:00.000Z",
  "providers": [
    {
      "id": "gemini-main",
      "name": "gemini-main",
      "displayName": "Gemini主账号",
      "type": "gemini",
      "apiUrl": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": "AIza...",
      "enabled": true,
      "defaultModel": "gemini-2.5-flash",
      "advancedConfig": {
        "defaultTemperature": 0.9,
        "enableDynamicThinking": true,
        "thinkingBudget": -1
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-20T10:00:00.000Z"
    },
    {
      "id": "deepseek-backup",
      "name": "deepseek-backup",
      "displayName": "DeepSeek备用",
      "type": "openai",
      "apiUrl": "https://api.deepseek.com/v1",
      "apiKey": "sk-...",
      "enabled": true,
      "defaultModel": "deepseek-chat",
      "customHeaders": {
        "X-Custom-Header": "value"
      }
    }
  ],
  "selectedProvider": "gemini-main",
  "selectedModel": "gemini-2.5-flash"
}
```

#### 🔧 配置界面 (`src/components/AIProviderSettings.tsx`)

**功能特性**：
- ✅ 可视化Provider管理（添加/编辑/删除/启用/禁用）
- ✅ 预设模板（Gemini、OpenAI、Claude、DeepSeek、Moonshot、智谱AI）
- ✅ 连接测试（实时检测API可用性和响应时间）
- ✅ API密钥显示/隐藏/复制
- ✅ 高级参数配置（温度、Top-P、Top-K、思考预算）
- ✅ Gemini 2.5专用：动态思考模式
- ✅ 配置导入导出（JSON文件）
- ✅ 配置验证（URL格式、必填字段、参数范围）
- ✅ 实时状态显示（连接状态、响应时间）

**使用示例**：
```tsx
import { AIProviderSettings } from '@/components/AIProviderSettings';

// 在任意页面使用
<AIProviderSettings 
  showStatus={true}  // 显示启用状态
  variant="outline"   // 按钮样式
/>
```

#### 🚀 使用示例

**方式1：直接使用统一客户端**
```typescript
import { getUnifiedAIClient } from '@/lib/ai/unified-client';

const client = getUnifiedAIClient();

// 使用指定提供商和模型
const result = await client.generateContent(
  'gemini-main',
  'gemini-2.5-flash',
  '写一个科幻故事开头',
  { temperature: 0.9 }
);

// 流式生成
for await (const chunk of client.generateContentStream(
  'deepseek-backup',
  'deepseek-chat',
  '继续故事情节'
)) {
  console.log(chunk);
}
```

**方式2：自动选择最佳Provider**
```typescript
import { autoGenerateContent } from '@/lib/ai/unified-client';

// 自动选择最优Provider（Gemini优先）
const result = await autoGenerateContent(
  '分析这段小说的写作手法',
  { temperature: 0.7 }
);
```

**方式3：获取使用统计**
```typescript
const client = getUnifiedAIClient();
const stats = client.getStatsSummary();

console.log(`总请求: ${stats.totalRequests}`);
console.log(`总Token: ${stats.totalTokens}`);
console.log(`平均响应时间: ${stats.averageResponseTime}ms`);
console.log('提供商使用情况:', stats.providerUsage);
// 输出: { 'gemini-main': 45, 'deepseek-backup': 12 }
```

#### 💡 技术亮点

1. **兼容性适配**：自动检测Gemini配置的API地址，如果指向第三方聚合服务，自动切换为OpenAI兼容模式
2. **智能路由**：根据模型类型、可用性、历史成功率自动选择最佳Provider
3. **配置迁移**：自动检测旧版单一Gemini配置，迁移到新的多Provider系统
4. **事件驱动**：配置变更实时通知所有订阅组件
5. **健康检查**：定期扫描Provider配置，报告潜在问题
6. **Token估算**：基于中英文混合文本的智能Token计数

#### 🎯 支持的AI服务商

| 服务商 | 类型 | 默认API地址 | 特色功能 |
|--------|------|-------------|----------|
| **Google Gemini** | gemini | `generativelanguage.googleapis.com` | 动态思考、长上下文 |
| **OpenAI** | openai | `api.openai.com/v1` | GPT-4、GPT-3.5 |
| **Anthropic Claude** | claude | `api.anthropic.com/v1` | Claude 3系列 |
| **DeepSeek** | openai | `api.deepseek.com/v1` | 性价比极高 |
| **Moonshot AI** | openai | `api.moonshot.cn/v1` | Kimi长文本 |
| **智谱AI** | openai | `open.bigmodel.cn/api/paas/v4` | ChatGLM国产 |
| **自定义** | custom | 任意OpenAI兼容端点 | 灵活扩展 |

---

### 2. 前端直调Gemini API（传统单一模式）

**为什么前端直调？**
- ✅ 无需部署后端服务器
- ✅ 响应速度更快（减少一层转发）
- ✅ 用户API密钥自己掌控，更安全
- ✅ 降低服务器成本
- ✅ 支持流式输出（SSE）

**核心实现**：

```typescript
// src/lib/gemini-client.ts

export async function callGeminiAPI(
  conversationHistory: ChatMessage[],
  chapterContext: string,
  apiKey: string,
  model: string = 'gemini-2.5-flash'
) {
  // 构建完整对话历史
  const contents = [
    {
      role: 'system',
      parts: [{ text: chapterContext }]
    },
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))
  ];

  // 直接调用Google API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 8192,
        }
      })
    }
  );

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

### 3. 书源解析引擎

**支持的规则类型**：

| 规则类型 | 示例 | 说明 |
|---------|------|------|
| CSS选择器 | `.book-title` | 标准CSS选择器 |
| XPath | `//div[@class='title']` | XPath表达式 |
| JSONPath | `$.data[*].name` | JSON数据提取 |
| JavaScript | `<js>处理代码</js>` | 动态执行JS |
| 混合规则 | `@css:.title@js:text.trim()` | 多规则组合 |
| 正则替换 | `replaceRegex` | 文本清洗 |
| 占位符 | `{{page}}`, `{{host()}}` | 动态变量替换 |

**核心解析器**：

```typescript
// src/lib/book-source-rule-parser.ts

export function parseRule(
  html: string,
  rule: string,
  context: ParseContext
): string | string[] {
  // 1. 处理JavaScript代码块
  if (rule.includes('<js>')) {
    const jsCode = extractJsCode(rule);
    return executeInSandbox(jsCode, context);
  }

  // 2. 处理混合规则 @css + @js
  if (rule.includes('@css') && rule.includes('@js')) {
    const cssResult = parseCssSelector(html, rule);
    const jsResult = executeJs(cssResult, rule);
    return jsResult;
  }

  // 3. 处理JSONPath
  if (rule.startsWith('$.')) {
    return parseJsonPath(html, rule);
  }

  // 4. 处理占位符
  const processed = replacePlaceholders(rule, context);

  // 5. 标准CSS选择器
  return parseCssSelector(html, processed);
}
```

**占位符系统**：

```typescript
const PLACEHOLDERS = {
  '{{page}}': () => currentPage.toString(),
  '{{host()}}': () => new URL(baseUrl).origin,
  '{{source.bookUrl}}': () => context.bookUrl,
  '{{source.chapterUrl}}': () => context.chapterUrl,
};
```

### 4. 智能缓存系统

**多级缓存策略**：

```typescript
// src/lib/cache-manager.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class CacheManager {
  private prefix = 'bookstore_cache_';

  // 存储缓存
  set<T>(key: string, data: T, duration: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: duration
    };
    localStorage.setItem(
      `${this.prefix}${this.hashKey(key)}`,
      JSON.stringify(entry)
    );
  }

  // 读取缓存
  get<T>(key: string): T | null {
    const item = localStorage.getItem(`${this.prefix}${this.hashKey(key)}`);
    if (!item) return null;

    const entry: CacheEntry<T> = JSON.parse(item);
    
    // 检查是否过期
    if (Date.now() > entry.timestamp + entry.expiry) {
      this.delete(key);
      return null;
    }

    return entry.data;
  }

  // 清理所有过期缓存
  cleanExpired(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix))
      .forEach(key => {
        const entry = JSON.parse(localStorage.getItem(key)!);
        if (Date.now() > entry.timestamp + entry.expiry) {
          localStorage.removeItem(key);
        }
      });
  }

  // 生成缓存键
  private hashKey(key: string): string {
    return btoa(encodeURIComponent(key)).substring(0, 32);
  }
}

export const cacheManager = new CacheManager();
```

**使用示例**：

```typescript
// 先查缓存
const cached = cacheManager.get<Book[]>('hot_books');
if (cached) {
  setBooks(cached);
  return;
}

// 缓存未命中，请求API
const response = await fetch('/api/bookstore/hot');
const data = await response.json();

// 存入缓存（30分钟）
cacheManager.set('hot_books', data, 30 * 60 * 1000);
setBooks(data);
```

### 5. SSE流式图片生成

**Next.js API路由**：

```typescript
// src/app/api/ai-image/generate/route.ts

export async function POST(request: Request) {
  const { prompt, count } = await request.json();

  // 创建SSE流
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // 异步处理
  (async () => {
    try {
      // 1. 提交任务
      writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'progress', message: '提交生成任务...' })}\n\n`
      ));

      const taskResponse = await fetch(DOUBAO_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DOUBAO_API_KEY}` },
        body: JSON.stringify({ prompt, num_images: count })
      });

      const { task_id } = await taskResponse.json();

      // 2. 轮询结果
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`${DOUBAO_API_URL}/${task_id}`);
        const status = await statusResponse.json();

        // 推送进度
        writer.write(encoder.encode(
          `data: ${JSON.stringify({
            type: 'progress',
            progress: status.progress
          })}\n\n`
        ));

        if (status.status === 'completed') {
          // 推送图片
          status.images.forEach((url: string) => {
            writer.write(encoder.encode(
              `data: ${JSON.stringify({ type: 'image', url })}\n\n`
            ));
          });
          completed = true;
        }
      }

      writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
    } catch (error) {
      writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
      ));
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**前端接收**：

```typescript
const eventSource = new EventSource('/api/ai-image/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt, count: 4 })
});

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'progress':
      setProgress(data.progress);
      break;
    case 'image':
      setImages(prev => [...prev, data.url]);
      break;
    case 'done':
      eventSource.close();
      break;
    case 'error':
      showError(data.message);
      eventSource.close();
      break;
  }
});
```

### 6. 双重章节导航系统

**问题场景**：
- 有些书源的"下一章"链接实际是"下一页"
- 单纯依赖HTML解析容易导致导航错误
- 需要可靠的章节跳转机制

**解决方案**：

```typescript
// src/app/bookstore/read/page.tsx

// 方案1：基于书籍章节列表（优先）
async function navigateByChapterList(direction: 'prev' | 'next') {
  // 获取完整章节列表
  const chaptersResponse = await fetch(`/api/bookstore/book?url=${bookUrl}`);
  const { chapters } = await chaptersResponse.json();

  // 定位当前章节
  const currentIndex = chapters.findIndex(ch => ch.url === currentChapterUrl);
  
  // 计算目标章节
  const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  
  if (targetIndex >= 0 && targetIndex < chapters.length) {
    const targetChapter = chapters[targetIndex];
    router.push(`/bookstore/read?url=${encodeURIComponent(targetChapter.url)}&bookUrl=${encodeURIComponent(bookUrl)}`);
    return true;
  }
  
  return false;
}

// 方案2：基于HTML提取（备用）
async function navigateByHtmlExtraction(direction: 'prev' | 'next') {
  const response = await fetch(`/api/bookstore/chapter?url=${currentChapterUrl}`);
  const { navigation } = await response.json();
  
  // 严格区分"下一章"和"下一页"
  const targetUrl = direction === 'next' 
    ? navigation.nextChapter  // 不是nextPage！
    : navigation.prevChapter;
  
  if (targetUrl) {
    router.push(`/bookstore/read?url=${encodeURIComponent(targetUrl)}`);
    return true;
  }
  
  return false;
}

// 智能导航函数
async function smartNavigate(direction: 'prev' | 'next') {
  // 优先使用章节列表导航
  if (bookUrl) {
    const success = await navigateByChapterList(direction);
    if (success) return;
  }
  
  // 降级到HTML提取
  await navigateByHtmlExtraction(direction);
}
```

**HTML导航提取优化**：

```typescript
// src/lib/book-source-utils.ts

function extractNavigation(html: string): Navigation {
  const $ = cheerio.load(html);
  
  // 查找导航链接
  const links = $('a').toArray();
  
  let prevChapter = null;
  let nextChapter = null;
  
  links.forEach(link => {
    const text = $(link).text().trim();
    const href = $(link).attr('href');
    
    // 严格匹配"上一章"
    if (/上一章|上一节|上一回/.test(text)) {
      prevChapter = resolveUrl(href, baseUrl);
    }
    
    // 严格匹配"下一章"，排除"下一页"
    if (/下一章|下一节|下一回/.test(text) && !/下一页/.test(text)) {
      nextChapter = resolveUrl(href, baseUrl);
    }
  });
  
  return { prevChapter, nextChapter };
}
```

---

## 📚 文档导航

| 文档 | 说明 |
|-----|------|
| [AI图片配置指南](docs/ai-image-setup.md) | 豆包AI图片生成完整配置教程 |
| [代理设置指南](docs/proxy-setup.md) | 国内服务器访问Google服务的代理配置 |
| [前端AI开发指南](docs/frontend-ai-guide.md) | 前端直调Gemini API的最佳实践 |
| [书源兼容性说明](docs/legado-book-source-compatibility.md) | 阅读APP书源格式兼容性文档 |
| [项目蓝图](docs/blueprint.md) | 项目整体架构和未来规划 |

---

## 🔧 常见问题 FAQ

### Q1: 国内能用吗？

**A:** 可以！但需要注意：

- **前端直调模式**：取决于你的本地网络环境。如果你的电脑可以访问Google（通过VPN等），就能正常使用所有AI功能。
- **服务端模式**（可选）：如果部署在国内服务器，需要配置HTTP代理。详见 [docs/proxy-setup.md](docs/proxy-setup.md)

### Q2: API Key安全吗？

**A:** 完全安全！

- ✅ 密钥仅保存在浏览器 `localStorage`
- ✅ 不会发送到任何服务器
- ✅ 不会记录在日志中
- ✅ 完全由你自己掌控
- ✅ 可随时清除或更换

### Q3: 为什么推荐 gemini-2.5-flash？

**A:** 性价比最高！

| 模型 | 特点 | 适用场景 |
|-----|------|---------|
| `gemini-2.5-flash` | 速度快、便宜、质量高 | **推荐**：日常创作、分析 |
| `gemini-2.5-pro` | 最强思考能力 | 复杂逻辑、深度分析 |
| `gemini-1.5-pro` | 上一代旗舰 | 长文本处理 |
| `gemini-1.5-flash` | 上一代快速版 | 预算有限 |

### Q4: 遇到请求受限怎么办？

**A:** 多种解决方案：

1. **等待配额恢复** - 免费版每分钟15次、每天1500次
2. **切换模型** - 换到 `gemini-2.5-flash`（消耗更少）
3. **优化提示词** - 减少不必要的长文本输入
4. **使用缓存** - 避免重复相同请求
5. **升级付费** - Google AI Studio支持付费提升配额

### Q5: 书城打不开或超时？

**A:** 排查步骤：

1. **检查书源状态** - 目标网站可能暂时不可用
2. **配置Cookie** - 有些网站需要登录，在「书源设置」→「认证管理」中添加Cookie
3. **设置代理** - 为特定书源配置 `proxyBase`
4. **更换书源** - 尝试其他可用书源
5. **查看控制台** - 按F12查看具体错误信息

### Q6: 如何添加新书源？

**A:** 编辑 `book_sources.json`：

```json
{
  "bookSourceName": "示例书源",
  "bookSourceUrl": "https://example.com",
  "bookSourceType": 0,
  "searchUrl": "https://example.com/search?key={{key}}",
  "ruleSearch": {
    "bookList": ".book-list > .item",
    "name": ".title",
    "author": ".author",
    "coverUrl": "img@src",
    "bookUrl": "a@href"
  },
  "ruleBookInfo": {
    "name": ".book-name",
    "author": ".author-name",
    "intro": ".intro",
    "coverUrl": ".cover@src",
    "tocUrl": "{{bookUrl}}/chapters"
  },
  "ruleToc": {
    "chapterList": ".chapter-list > li",
    "chapterName": "a",
    "chapterUrl": "a@href"
  },
  "ruleContent": {
    "content": ".chapter-content",
    "nextPageUrl": ".next-page@href"
  }
}
```

详见：[docs/legado-book-source-compatibility.md](docs/legado-book-source-compatibility.md)

### Q7: 如何贡献代码？

**A:** 欢迎贡献！

1. Fork本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交改动：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交Pull Request

### Q8: 移动端体验如何？

**A:** 完全适配！

- ✅ 响应式布局（图墙模式）
- ✅ 触摸手势支持
- ✅ 移动端优化的字体和间距
- ✅ Hover悬浮层（长按触发）
- ✅ 底部导航栏
- ✅ PWA支持（可添加到主屏幕）

### Q9: 可以离线使用吗？

**A:** 部分功能支持：

- ✅ 已缓存的书城数据
- ✅ 本地创作的章节和设定
- ✅ 已下载的角色卡片
- ❌ AI功能需要网络
- ❌ 书城新内容需要网络

### Q10: 如何同时使用多个AI提供商？

**A:** 使用统一AI配置系统：

1. **添加多个Provider** - 在AI配置界面添加Gemini、DeepSeek、OpenAI等
2. **设置优先级** - 启用/禁用不同Provider，系统自动选择
3. **自动故障转移** - 主Provider失败时自动切换备用
4. **配置导出** - 一键导出所有配置，方便迁移和备份

**推荐配置**：
- **主力**：Gemini 2.5 Flash（免费额度大）
- **备用1**：DeepSeek（性价比高，国内可用）
- **备用2**：Moonshot AI（长文本场景）

### Q11: 配置导入导出怎么用？

**A:** 完整的配置管理流程：

**导出配置**：
1. 打开「AI配置」
2. 点击「导出配置」按钮
3. 自动下载 `ai-providers-YYYY-MM-DD.json` 文件

**导入配置**：
1. 打开「AI配置」
2. 点击「导入配置」，选择JSON文件
3. 选择导入选项：
   - 跳过已存在的配置（默认）
   - 覆盖现有配置
4. 系统自动验证并导入有效配置

**应用场景**：
- 团队共享配置
- 多设备同步
- 配置备份
- 快速部署

### Q12: 性能如何优化？

**A:** 内置多重优化：

1. **智能缓存** - 多级缓存策略减少90%重复请求
2. **按需加载** - 组件懒加载和代码分割
3. **图片优化** - Next.js Image自动优化
4. **SSG/SSR混合** - 静态页面+动态路由
5. **CDN加速** - 静态资源CDN分发
6. **AI智能路由** - 自动选择最快响应的Provider

---

## 🚀 部署指南

### Vercel部署（推荐）

1. Fork本仓库
2. 登录 [Vercel](https://vercel.com)
3. 点击「Import Project」
4. 选择你的仓库
5. 配置环境变量（如需服务端AI）：
   ```
   GEMINI_API_KEY=your_key
   DOUBAO_API_KEY=your_key
   ```
6. 点击「Deploy」

### Docker部署

```bash
# 构建镜像
docker build -t dog-writing-engine .

# 运行容器
docker run -p 9002:9002 \
  -e GEMINI_API_KEY=your_key \
  dog-writing-engine
```

### 传统服务器部署

```bash
# 1. 构建
npm run build

# 2. 启动
npm run start

# 3. 使用PM2守护进程
pm2 start npm --name "dog-writing" -- start
pm2 save
pm2 startup
```

---

## 🎨 截图展示

### 📱 书城主页
```
┌────────────────────────────────────┐
│   🔍 搜索框                        │
├────────────────────────────────────┤
│  📚 热门推荐（图墙布局）            │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   │
│  │📕│ │📗│ │📘│ │📙│ │📔│ │📓│   │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘   │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   │
│  │📕│ │📗│ │📘│ │📙│ │📔│ │📓│   │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘   │
├────────────────────────────────────┤
│  📂 分类导航                        │
│  [玄幻] [武侠] [都市] [言情] ...   │
└────────────────────────────────────┘
```

### 🤖 AI仿写工作区
```
┌────────────────────────────────────┐
│  📖 《示例小说》- 第1章             │
│  [清空会话]                         │
├────────────────────────────────────┤
│  章节内容显示区域...                │
├────────────────────────────────────┤
│  💬 对话历史                        │
│  ┌──────────────────────────────┐ │
│  │ 👤 用户: 分析这段的写作手法  │ │
│  │ [编辑] [删除]                 │ │
│  └──────────────────────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ 🤖 AI: 这段采用了...          │ │
│  │ [编辑] [删除]                 │ │
│  └──────────────────────────────┘ │
├────────────────────────────────────┤
│  快捷功能：                         │
│  [仿写开头] [剧情总结] [卖点分析]  │
│  [角色分析] [写作风格]             │
├────────────────────────────────────┤
│  💭 输入框（多行）                  │
│  提示：Ctrl+Enter 发送             │
└────────────────────────────────────┘
```

### 🎨 AI图片生成
```
┌────────────────────────────────────┐
│  ✨ AI图片生成                      │
├────────────────────────────────────┤
│  📝 描述输入框                      │
│  [提示词示例▼]                      │
├────────────────────────────────────┤
│  [开始生成]                         │
├────────────────────────────────────┤
│  🖼️ 生成结果（图墙）                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │     │ │     │ │     │ │     │  │
│  │ 🎭  │ │ 🌄  │ │ 🦄  │ │ 🏰  │  │
│  │     │ │     │ │     │ │     │  │
│  └─────┘ └─────┘ └─────┘ └─────┘  │
│  [下载] [下载] [下载] [下载]       │
└────────────────────────────────────┘
```

---

## 🛣 路线图 Roadmap

### ✅ 已完成

- [x] **统一AI客户端系统** - 支持7+AI服务商
- [x] **配置导入导出** - JSON格式配置管理
- [x] **多Provider管理** - 添加/编辑/删除/测试连接
- [x] **智能路由** - 自动选择最佳Provider
- [x] **AI率检测（逆向）** - 逆向ailv.run API
- [x] **基础AI创作功能** - Gemini/OpenAI/Claude等集成
- [x] **在线书城系统** - 多书源解析引擎
- [x] **AI仿写对话管理** - 消息编辑/删除/多行输入
- [x] **AI图片生成** - 豆包AI + SSE流式
- [x] **智能缓存系统** - 多级缓存，减少90%请求
- [x] **移动端响应式设计** - 图墙布局
- [x] **章节/角色/世界观管理** - 完整创作工具集
- [x] **双重章节导航** - 可靠的章节跳转
- [x] **使用统计** - Token计数、响应时间追踪

### 🚧 进行中

- [ ] PWA支持（添加到主屏幕）
- [ ] 离线模式增强
- [ ] 更多AI模型支持（OpenAI、Claude）
- [ ] 协同编辑功能

### 📋 计划中

- [ ] 移动端APP（React Native）
- [ ] 桌面端应用（Electron）
- [ ] 云端同步（Firebase/Supabase）
- [ ] 社区分享功能
- [ ] 插件市场
- [ ] 多语言支持
- [ ] AI语音朗读
- [ ] 图表可视化（节奏分析、角色关系图）
- [ ] 导出功能（PDF、EPUB、DOCX）
- [ ] 版本控制（Git-like）

---

## 🤝 贡献指南

### 贡献方式

我们欢迎任何形式的贡献：

- 🐛 **报告Bug** - 提交Issue描述问题
- 💡 **功能建议** - 分享你的想法
- 📝 **改进文档** - 修正错误或补充说明
- 💻 **提交代码** - 修复Bug或添加新功能
- 🌍 **翻译** - 帮助多语言支持
- ⭐ **Star项目** - 让更多人发现

### 开发流程

1. **Fork仓库**
2. **创建分支**：`git checkout -b feature/NewFeature`
3. **编写代码**：遵循TypeScript和React最佳实践
4. **测试功能**：确保不影响现有功能
5. **提交改动**：`git commit -m 'Add NewFeature'`
6. **推送分支**：`git push origin feature/NewFeature`
7. **提交PR**：详细描述改动和测试情况

### 代码规范

- **TypeScript** - 严格类型检查，避免 `any`
- **组件** - 功能组件 + Hooks，避免class组件
- **样式** - 使用Tailwind CSS，避免内联样式
- **命名** - 驼峰命名（camelCase）用于变量，帕斯卡（PascalCase）用于组件
- **注释** - 复杂逻辑必须注释
- **格式** - 使用Prettier格式化

### Commit规范

```
feat: 新功能
fix: 修复Bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
perf: 性能优化
test: 测试相关
chore: 构建/工具配置
```

示例：
```bash
feat: 添加AI图片批量下载功能
fix: 修复书城缓存过期判断错误
docs: 更新部署指南
```

---

## 🙏 致谢

### 技术栈

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React全栈框架
- [React](https://reactjs.org/) - UI库
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Tailwind CSS](https://tailwindcss.com/) - CSS框架
- [shadcn/ui](https://ui.shadcn.com/) - 组件库
- [Lucide](https://lucide.dev/) - 图标库
- [Cheerio](https://cheerio.js.org/) - HTML解析
- [Firebase](https://firebase.google.com/) - 后端服务

### AI服务

- [Google Gemini](https://ai.google.dev/) - 智能创作能力
- [豆包AI](https://www.volcengine.com/) - 图片生成服务
- ailv.run - AI检测服务（通过逆向工程实现免费调用）

### 灵感来源

- [阅读APP](https://github.com/gedoor/legado) - 书源格式参考
- [Novel AI](https://novelai.net/) - 创作工具灵感
- [Notion](https://notion.so/) - 管理界面参考

---

## 📄 许可证

本项目采用 **MIT** 许可证 - 详见 [LICENSE](LICENSE) 文件

```
MIT License

Copyright (c) 2025 Dog写作引擎

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 联系方式

- **GitHub Issues**: [提交Issue](https://github.com/your-username/dog-writing-engine/issues)
- **qq**: [参与讨论](点击链接加入群聊【开源狗狗码字项目】：https://qun.qq.com/universal-share/share?ac=1&authKey=8UGSD089UNOpMasstObtoNIehS8FQ10xBgpCJQ7tDcS8OU0YxMfvZi3aajlPS%2BpA&busi_data=eyJncm91cENvZGUiOiIxMDMzNzI1NzcyIiwidG9rZW4iOiJaVFhYS0JJZGJJbS9JQ1d5alNQZEVSS1oyS05pYXJ4Ky9La1lILzkyZHduN1hhUzBISnAraUNxLzRPTVY0eHQ3IiwidWluIjoiMzUyNzIyODgxOSJ9&data=d1f6kgQIHnEM8aPynSOSyz_Yptt661InyHuv-6L8MsgJnntWQ7bsWhwdMIp4krBMfc8s7CJdVVGYy2TtoQvyVQ&svctype=4&tempid=h5_group_info)
- **Email**: 3527228819@qq.com

---

## ⭐ Star历史

[![Star History Chart](https://api.star-history.com/svg?repos=your-username/dog-writing-engine&type=Date)](https://star-history.com/#your-username/dog-writing-engine&Date)

---

<div align="center">

**如果这个项目对你有帮助，请给一个⭐Star支持一下！**

Made with ❤️ by Dog写作引擎团队

[⬆ 回到顶部](#-dog写作引擎---新一代ai小说创作平台)

</div>
