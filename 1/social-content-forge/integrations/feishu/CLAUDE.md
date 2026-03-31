# 飞书集成模块

负责将生成的内容全自动同步到飞书多维表格。

## 配置

所有配置从环境变量读取：
```
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_TABLE_ID
```

## 飞书API端点

```
获取 Tenant Access Token:
POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
Body: { "app_id": "...", "app_secret": "..." }

写入多维表格记录:
POST https://open.feishu.cn/open-apis/bitable/v1/apps/{table_id}/records
Headers: Authorization: Bearer {tenant_access_token}
```

## 多维表格字段映射

| 字段名 | 类型 | 来源 |
|-------|------|------|
| content_id | 文本 | 生成UUID |
| 标题 | 文本 | 从内容提取或生成 |
| 来源类型 | 单选 | url/search/material |
| 原始链接 | 链接 | 输入URL |
| 综合评分 | 数字 | evaluator输出 |
| 情绪分 | 数字 | evaluator输出 |
| 实用分 | 数字 | evaluator输出 |
| 叙事分 | 数字 | evaluator输出 |
| 状态 | 单选 | 固定值"草稿" |
| 微信版本 | 文本 | 输出文件路径 |
| 小红书版本 | 文本 | 输出文件路径 |
| Twitter版本 | 文本 | 输出文件路径 |
| 创建时间 | 时间 | 当前时间 |

## 同步流程

```
1. 获取 tenant_access_token（有效期2小时）
   └─ 失败则记录日志，降级到仅文件输出

2. 构建记录数据
   └─ 字段映射到飞书格式

3. 写入多维表格
   └─ POST /bitable/v1/apps/{table_id}/records

4. 成功 → 输出飞书记录链接
   失败 → 记录错误日志，降级
```

## 错误处理

- Token获取失败：重试3次，间隔2s/4s/8s
- 写入失败：记录到 error.log，返回降级输出
- 字段超限：截断文本字段（飞书限制）

## 依赖

- axios：HTTP请求
- uuid：生成content_id
- dotenv：环境变量
