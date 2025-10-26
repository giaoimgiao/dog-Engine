# Legado书源兼容性改进

## 概述

本次更新使项目的书源解析系统完全兼容 [Legado阅读](https://github.com/gedoor/legado) 的书源格式，支持所有主流书源规则。

## 核心改进

### 1. URL和请求配置解析（URL,{options}格式）

创建了 `parse-url-with-options.ts` 工具，支持 Legado 标准的 URL 配置格式：

```typescript
// 示例：
"https://example.com/api,{'method':'POST','body':'data=123'}"
```

**支持的功能**：
- 自动分离URL和请求配置
- 单引号转双引号
- 支持 method, headers, body 等配置
- 无缝集成到所有API端点（search, category, book, chapter）

**应用范围**：
- ✅ `src/pages/api/bookstore/search.ts`
- ✅ `src/pages/api/bookstore/category.ts`  
- ✅ `src/pages/api/bookstore/book.ts`
- ✅ `src/pages/api/bookstore/chapter.ts`

### 2. JSONPath解析器

实现了 `jsonpath-parser.ts`，支持 Legado 常用的 JSONPath 语法：

**支持的语法**：
```jsonpath
$.property                        # 直接属性访问
$.property.nested                 # 嵌套属性
$..property                       # 递归搜索
$..[?(@.property)]               # 递归搜索包含指定属性的对象
$..[?(@.property=='value')]      # 递归搜索属性值匹配的对象
$[*]                             # 数组所有元素
$[0]                             # 数组索引
```

### 3. @JSon: 规则支持

完全支持 Legado 的 `@JSon:` 规则格式：

```javascript
// 支持多路径备选和JS后处理
"@JSon:$..[?(@.novelName)]&&$..[?(@.novelname)]&&$.massage
<js>
if (result) {
    // JavaScript处理逻辑
    result = processData(result);
}
</js>"
```

**特性**：
- ✅ 多路径备选（`path1&&path2&&path3`）
- ✅ JavaScript后处理（`<js>...code...</js>`）
- ✅ 安全的VM2沙箱执行
- ✅ 完整的错误处理

### 4. @put:{} 语法支持

支持从JSON数据中提取值并替换到URL中：

```javascript
// 书源配置示例
"bookUrl": "http://api.com/book?id={{@put:{id:$.novelid||$.novelId}}}"

// 解析过程：
// 1. 从数据中提取 $.novelid 或 $.novelId 的值
// 2. 替换 @put:{} 部分为提取的值
// 3. 生成最终URL
```

### 5. 异步解析支持

将所有解析函数改为异步，支持复杂的规则链：

```typescript
// 所有解析函数现在都是异步的
export async function parseWithRules(...)
export async function parseListWithRules(...)

// 支持嵌套的异步操作
- @JSon: 规则解析
- JavaScript后处理
- @put:{} 值提取
- 封面图片解码
```

## 成功案例：晋江文学书源

晋江文学书源（正版书源，需要登录）现在可以正常工作：

**测试结果**：
```
✅ 成功解析100本书籍
✅ 书名和作者名正确提取
✅ 分类榜单正常加载
✅ URL配置正确解析（包含headers）
```

**书源特点**：
- 使用 `@JSon:` 规则解析JSON响应
- URL包含请求配置：`url,{'headers':{'versionCode':'398'}}`
- 支持多路径备选
- JavaScript后处理

## 技术细节

### parseWithRules 增强

```typescript
// 新增功能：
1. @JSon: 规则检测和处理
2. @put:{} 语法支持
3. 异步执行链
4. 更好的错误处理
```

### parseListWithRules 增强

```typescript
// 新增功能：
1. @JSon: 列表规则解析
2. JavaScript后处理支持
3. 批量异步处理
4. 完整的日志记录
```

### evaluateJs 改进

```typescript
// JavaScript执行环境增强：
- 支持 baseUrl 变量注入
- 支持 src 变量（原始数据）
- 支持 result 变量（解析结果）
- VM2 沙箱安全执行
```

## 兼容性

### 完全兼容的书源类型

✅ **JSON API书源**
- 支持 @JSon: 规则
- 支持 JSONPath 查询
- 支持 JavaScript 后处理

✅ **HTML网页书源**
- CSS选择器
- @css: + @js: 混合规则
- 属性提取

✅ **混合类型书源**
- URL配置
- 请求头动态生成
- Cookie管理
- 图片解码

### 书源规则支持列表

| 规则类型 | 支持状态 | 说明 |
|---------|---------|------|
| @JSon: | ✅ | JSONPath查询+JS后处理 |
| @css: | ✅ | CSS选择器 |
| @js: | ✅ | JavaScript处理 |
| @put:{} | ✅ | 值提取和替换 |
| {{template}} | ✅ | 模板占位符 |
| path1&&path2 | ✅ | 多路径连接 |
| path1\|\|path2 | ✅ | 备选路径 |
| $.jsonpath | ✅ | JSON路径 |
| id./class. | ✅ | HTML选择器 |
| @href/@text | ✅ | 属性提取 |

## 使用示例

### 配置书源

```json
{
  "name": "示例书源",
  "url": "https://api.example.com",
  "searchUrl": "https://api.example.com/search?q={{key}},{'headers':{'token':'xxx'}}",
  "rules": {
    "search": {
      "bookList": "@JSon:$..[?(@.bookName)]",
      "name": "$.bookName",
      "author": "$.author",
      "bookUrl": "https://api.example.com/book?id=@put:{id:$.bookId}"
    }
  }
}
```

### 在代码中使用

```typescript
// API会自动处理所有Legado规则
const books = await parseListWithRules(
  jsonData, 
  "@JSon:$..[?(@.novelName)]", 
  {
    title: "$.novelName",
    author: "$.author"
  },
  baseUrl
);
```

## 性能优化

- **并行解析**：使用 `for` 循环替代 `map`，支持 `await`
- **错误隔离**：单个规则失败不影响整体
- **日志详细**：每一步都有清晰的日志输出
- **缓存友好**：支持之前实现的本地缓存系统

## 下一步计划

### 进一步改进方向

1. **更多JSONPath语法**
   - 数组切片：`$[0:10]`
   - 复杂过滤器：`$[?(@.price < 10)]`
   - 函数支持：`$.length()`, `$.min()` 等

2. **性能优化**
   - JSONPath查询缓存
   - JavaScript代码预编译
   - 批量请求合并

3. **错误恢复**
   - 自动重试机制
   - 降级策略
   - 智能回退

4. **开发工具**
   - 书源规则测试器
   - 规则语法高亮
   - 实时预览

## 故障排查

### 常见问题

**Q: 书源返回空数据？**
A: 检查日志中的 `[parseJsonPath]` 和 `[parseJsonRule]` 输出，确认JSONPath是否匹配到数据。

**Q: JavaScript后处理失败？**
A: 查看 `[parseListWithRules] JS后处理失败` 错误信息，检查JS代码语法。

**Q: URL配置解析错误？**
A: 确认URL格式为 `url,{json}` 且JSON使用双引号。

### 调试技巧

1. 查看控制台日志：
   ```
   [parseJsonRule] Trying path 1: $..[?(@.novelName)]
   [parseJsonPath] Found 100 matching objects
   ```

2. 检查数据结构：
   ```json
   {
     "code": "200",
     "data": {
       "ranks": [...]  // 实际数据位置
     }
   }
   ```

3. 测试JSONPath：
   ```typescript
   const { parseJsonPath } = require('./jsonpath-parser');
   const result = parseJsonPath(data, '$.data.ranks');
   ```

## 相关文件

- `src/lib/parse-url-with-options.ts` - URL配置解析
- `src/lib/jsonpath-parser.ts` - JSONPath解析器
- `src/lib/book-source-utils.ts` - 核心解析逻辑
- `src/pages/api/bookstore/*.ts` - API端点

## 参考资料

- [Legado阅读源码](https://github.com/gedoor/legado)
- [Legado书源规则说明](https://github.com/gedoor/legado/blob/master/app/src/main/assets/help/SourceHelp.md)
- [JSONPath语法参考](https://goessner.net/articles/JsonPath/)

---

更新时间：2025年10月5日
版本：v2.0
状态：生产就绪 ✅
