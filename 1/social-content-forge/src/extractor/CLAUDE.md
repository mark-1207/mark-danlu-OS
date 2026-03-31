# Extractor 模块

内容提取器。负责从不同来源提取原始内容。

## 支持的输入类型

| 类型 | 识别方式 | 处理方式 |
|------|---------|---------|
| URL | 以 `mp.weixin.qq.com` 开头 | 调用 wechat-article-extractor skill |
| 主题 | 关键词/话题描述 | 搜索相关爆款文章 |
| 素材 | 粘贴的文字/笔记/大纲 | 直接返回 |

## 处理流程

### 1. URL 输入
```
识别URL类型
  └─ mp.weixin.qq.com → 调用 wechat-article-extractor skill
  └─ 其他 → 提示不支持
```

### 2. 主题输入
```
搜索阶段
  ├─ 并行搜索多个来源
  ├─ 优先获取高阅读量内容
  └─ 提取摘要+核心观点
```

### 3. 素材输入
```
直接进入分析阶段
  └─ 验证内容非空
```

## URL提取依赖

使用已有的 `wechat-article-extractor` skill：
```javascript
// 调用方式
const result = await extract('https://mp.weixin.qq.com/s/xxx');
// 返回: { done: true, data: { title, content, author, ... } }
```

## 输出格式

```json
{
  "type": "url|search|material",
  "source": "原始URL或搜索关键词",
  "content": "提取的文本内容",
  "metadata": {
    "title": "文章标题",
    "author": "作者",
    "publishTime": "发布时间",
    "source": "来源平台"
  }
}
```

## 错误处理

- URL解析失败：提示用户提供文章全文
- 搜索无结果：提示调整关键词
- 内容为空：提示用户提供更多素材
