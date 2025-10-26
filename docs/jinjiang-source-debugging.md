# 晋江书源调试说明

## 问题诊断

### 1. 封面图片解析失败 ✅ 已修复

**问题**：
```
[parseJsonPath] Parsing path: $.cover||$.novelCover||$.ebookurl||$.novel_cover
[parseJsonPath] Property "cover||$" not found
```

**原因**：JSONPath解析器把 `||` 当作属性名的一部分

**修复**：在 `jsonpath-parser.ts` 中添加了 `||` 作为备选路径分隔符的支持

### 2. bookUrl处理错误 ✅ 已修复

**问题**：
```
替换后的规则: http://app-cdn.jjwxc.net/androidapi/novelbasicinfo?novelId={{$.novelid||$.novelId}}3553682
```

**原因**：书源配置同时使用了 `{{模板}}` 和 `@put:{}` 语法

**配置**：
```json
"bookUrl": "http://app-cdn.jjwxc.net/androidapi/novelbasicinfo?novelId={{$.novelid||$.novelId}}@put:{id:$.novelid||$.novelId}"
```

**修复**：改进了 `@put:{}` 和 `{{}}` 的同时处理逻辑

## 当前状态

### ✅ 已解决
1. URL和请求配置解析（`URL,{options}`）
2. @JSon: 规则的 `||` 备选路径
3. @put:{} 和 {{}} 模板的同时处理
4. 书名和作者名提取

### ⚠️ 待测试
1. 封面图片URL提取
2. 书籍详情URL生成
3. 章节列表获取
4. 章节内容读取

### 🔍 潜在问题

#### 1. JavaScript后处理中的Web环境兼容性

封面字段配置包含JavaScript代码：
```javascript
<js>
if(/(?:postimg|bmp|alicdn)\./.test(result)){
    java.setContent(src);  // ⚠️ Web环境不支持
    result = "https://i9-static.jjwxc.net/novelimage.php?novelid={{$.novelId}}"
} else {
    result = result
}
header = {
    "headers":{
        "referer":result.match(/(^https?:\/\/.*?\/)/)[1]
    }
}
result = (result +","+ JSON.stringify(header)).replace(/wx\d+/,'wx2')
</js>
```

**问题**：
- `java.setContent(src)` 在Web环境无效
- `{{$.novelId}}` 模板需要在JS执行前处理

**解决方案**：
- evaluateJs 中已mock了 `java` 对象
- 需要在JS执行前先处理模板

#### 2. 数据结构验证

需要确认JSON响应的实际结构：
```json
{
  "code": "200",
  "data": {
    "ranks": [
      {
        "novelid": "4472959",
        "novelname": "她的山，她的海",
        "novel_cover": "https://...",
        "authorname": "扶华",
        ...
      }
    ]
  }
}
```

## 测试步骤

### 1. 测试封面字段解析

**预期**：
- 输入：`@JSon:$.cover||$.novelCover||$.novel_cover`
- 输出：封面URL（带headers配置）

**验证点**：
- [ ] JSONPath能找到 `novel_cover` 字段
- [ ] JavaScript后处理正常执行
- [ ] 返回格式：`url,{"headers":{"referer":"..."}}`

### 2. 测试bookUrl生成

**预期**：
- 输入数据：`{"novelid": "4472959"}`
- 规则：`http://...?novelId={{$.novelid}}@put:{id:$.novelid}`
- 输出：`http://...?novelId=4472959`

**验证点**：
- [ ] `{{$.novelid}}` 被替换
- [ ] `@put:{id:$.novelid}` 被替换
- [ ] 两个值相同

### 3. 测试完整流程

```
分类页面 → 书籍列表 → 书籍详情 → 章节列表 → 章节内容
```

**检查点**：
1. [ ] 分类页面显示100本书
2. [ ] 书名和作者正确
3. [ ] 封面图片显示
4. [ ] 点击书籍能获取详情
5. [ ] 章节列表完整
6. [ ] 章节内容可读

## 日志分析

### 成功的日志示例

```
[parseJsonRule] Trying 4 alternative paths
[parseJsonRule] Trying path 1: $.cover
[parseJsonPath] Property "cover" not found
[parseJsonRule] Trying path 2: $.novelCover
[parseJsonPath] Property "novelCover" not found
[parseJsonRule] Trying path 3: $.ebookurl
[parseJsonPath] Property "ebookurl" not found
[parseJsonRule] Trying path 4: $.novel_cover
[parseJsonPath] Found property: https://i7-static.jjwxc.net/...
[parseJsonRule] ✅ Path 4 succeeded
```

### bookUrl处理日志

```
[parseWithRules] 检测到 @put: 语法
[parseWithRules] @put 提取: id=4472959
[parseWithRules] 处理模板: {{$.novelid||$.novelId}}
[parseWithRules] 模板值: 4472959
[parseWithRules] 最终规则: http://...?novelId=4472959
```

## 常见问题

### Q: 封面图片显示"300×400"占位图？

A: 检查以下几点：
1. 封面URL是否正确提取
2. 图片代理是否工作
3. Headers是否正确传递
4. 检查浏览器Network面板的图片请求

### Q: 点击书籍无反应？

A: 检查：
1. bookUrl是否正确生成
2. 控制台是否有错误
3. API请求是否成功
4. 检查 `/api/bookstore/book` 的日志

### Q: 章节列表为空？

A: 检查：
1. tocUrl是否正确
2. 目录页面是否需要登录
3. 规则是否匹配数据结构
4. 检查 API 日志中的 toc 解析

## 下一步优化

1. **缓存优化**：封面图片、书籍详情缓存
2. **错误处理**：友好的错误提示
3. **性能优化**：批量请求、懒加载
4. **用户体验**：加载动画、骨架屏

## 相关文件

- `src/lib/jsonpath-parser.ts` - JSONPath解析器
- `src/lib/book-source-utils.ts` - 规则解析核心
- `src/lib/parse-url-with-options.ts` - URL配置解析
- `src/pages/api/bookstore/category.ts` - 分类API
- `book_sources.json` - 书源配置

---
更新时间：2025年10月5日
