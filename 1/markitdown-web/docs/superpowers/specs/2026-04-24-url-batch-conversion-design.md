# markitdown-web URL 批量转换修复方案

## 问题

URL 转换存在以下问题，与文件转换功能不一致：

1. **批量转换内容互相覆盖** — 循环中每个 URL 完成后都调用 `showResult()`，覆盖 `currentMarkdown`
2. **批量转换没有预览逻辑** — 没有类似文件的 `isBatchMode` 判断，批量模式下不应该显示单个预览
3. **loading 不消失** — `showLoading(true)` 后循环结束时才关闭，过程中用户看不到进度
4. **缺少质量校验** — 文件转换有 `validateConversion`，URL 没有
5. **缺少错误详情** — 失败时只显示 `!` 状态，没有错误原因
6. **缺少批量下载** — 文件转换有 ZIP 批量下载，URL 没有
7. **后端 batch 参数未传递** — 后端已支持 `batch=true` 跳过 metadata 提取，前端未传

## 设计

### 1. 前端 — URL 转换新增 `urlQueue` 条目结果存储

在 `urlQueue` 的每个条目中新增 `result` 和 `errorMsg` 字段，与 `fileQueue` 保持一致：

```javascript
urlQueue.push({ url, status: 'pending', result: null, errorMsg: null })
```

### 2. 前端 — URL 转换 `batch` 模式标识

新增 `urlBatchMode` 变量，在批量转换时设置：

```javascript
document.getElementById('url-convert').addEventListener('click', async () => {
  const pending = urlQueue.filter(u => u.status === 'pending')
  if (pending.length === 0) return

  // 批量模式：多个待处理 URL
  urlBatchMode = pending.length > 1

  const startTime = Date.now()
  let successCount = 0
  let failCount = 0

  showLoading(true)
  for (const item of pending) {
    const index = urlQueue.indexOf(item)
    urlQueue[index].status = 'converting'
    urlQueue[index].errorMsg = null
    renderUrlList()

    try {
      const formData = new FormData()
      formData.append('url', item.url)
      formData.append('keep_data_uris', document.getElementById('url-keep-uris').checked)
      formData.append('batch', urlBatchMode)  // 传递 batch 参数

      const resp = await fetch(API + '/convert/url', { method: 'POST', body: formData })
      const data = await resp.json()

      if (data.success) {
        const isValid = validateConversion(data.markdown, item.url)
        if (isValid) {
          urlQueue[index].status = 'done'
          urlQueue[index].result = data
          successCount++
        } else {
          urlQueue[index].status = 'fail'
          urlQueue[index].errorMsg = '转换质量异常（内容乱码或过短）'
          failCount++
        }
      } else {
        urlQueue[index].status = 'fail'
        urlQueue[index].errorMsg = data.detail || '转换失败'
        failCount++
      }
    } catch (e) {
      urlQueue[index].status = 'fail'
      urlQueue[index].errorMsg = e.message || '网络错误'
      failCount++
    }
    renderUrlList()
  }
  showLoading(false)

  // 批量模式下显示总结，不显示单个预览
  if (urlBatchMode) {
    showUrlBatchSummary(successCount, failCount, Date.now() - startTime)
  }
  showResult(urlQueue[pending[0].originalIndex]?.result?.markdown, urlQueue[pending[0].originalIndex]?.result?.meta)
})
```

### 3. 前端 — `showResult` 改为批量安全

`showResult` 函数开头判断批量模式，批量时直接返回不覆盖预览：

```javascript
function showResult(markdown, meta) {
  currentMarkdown = markdown || currentMarkdown

  // 批量模式下不显示单个预览
  if (isBatchMode || urlBatchMode) return

  // ... 后续显示逻辑
}
```

### 4. 前端 — 批量总结面板 `showUrlBatchSummary`

新增与文件转换一致的批量总结：

```javascript
function showUrlBatchSummary(success, failed, durationMs) {
  const elapsed = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`
  const failedItems = urlQueue.filter(u => u.status === 'fail')

  let html = `
    <div class="batch-summary-header">
      <span class="batch-summary-title">URL 转换完成</span>
      <span class="batch-summary-time">用时 ${elapsed}</span>
    </div>
    <div class="batch-summary-stats">
      <div class="batch-stat total">
        <span class="stat-value">${success + failed}</span>
        <span class="stat-label">总计</span>
      </div>
      <div class="batch-stat success">
        <span class="stat-value">${success}</span>
        <span class="label">成功</span>
      </div>
      <div class="batch-stat error">
        <span class="stat-value">${failed}</span>
        <span class="label">失败</span>
      </div>
    </div>`

  if (failedItems.length > 0) {
    html += `<div class="batch-failed-list">`
    failedItems.forEach(u => {
      html += `<div class="failed-item">
        <span class="failed-icon">!</span>
        <span>${truncateUrl(u.url)}</span>
      </div>
      <div class="batch-failed-reason">${u.errorMsg || '未知错误'}</div>`
    })
    html += `</div>`
  }

  document.getElementById('batch-summary').innerHTML = html
  document.getElementById('batch-summary').style.display = 'block'
}
```

### 5. 前端 — URL 列表显示错误详情

`renderUrlList` 在 `fail` 状态时显示错误详情：

```javascript
url-item .url-status.fail { background: var(--error); color: white; }
// 已有

// 新增：失败时 hover 显示错误原因
.url-item:hover .url-error-tooltip { display: block }
```

```javascript
window.showUrlError = function(index) {
  const item = urlQueue[index]
  if (item.errorMsg) {
    alert(`转换失败: ${item.errorMsg}`)
  }
}
```

### 6. 前端 — URL 批量下载

新增批量下载按钮，当 URL 批量转换完成后启用：

```javascript
// 在 URL tab 添加下载按钮（批量转换完成后显示）
<button class="btn btn-success" id="url-batch-download" style="margin-top: 16px; display: none;">
  下载已转换 (0)
</button>
```

```javascript
document.getElementById('url-batch-download').addEventListener('click', async () => {
  const done = urlQueue.filter(u => u.status === 'done' && u.result)
  if (done.length === 0) return

  if (done.length === 1) {
    // 单个直接下载
    const item = done[0]
    const blob = new Blob([item.result.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (item.result.filename || 'url_output') + '.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return
  }

  // 多个打包 ZIP
  const zip = new JSZip()
  for (const item of done) {
    const filename = (item.result.filename || 'url_output') + '.md'
    zip.file(filename, item.result.markdown)
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `url_converted_${Date.now()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
})
```

### 7. 前端 — `urlBatchMode` 变量与重置逻辑

```javascript
let urlBatchMode = false

// reset 时也要重置
document.getElementById('reset-btn').addEventListener('click', () => {
  // ... 现有逻辑
  urlBatchMode = false
})
```

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `static/index.html` | 1. `urlQueue` 条目增加 `result`, `errorMsg`<br>2. `url-convert` handler 增加 `urlBatchMode`、batch参数传递、质量校验、错误详情<br>3. `renderUrlList` 显示错误详情<br>4. 新增 `showUrlBatchSummary`<br>5. 新增 `url-batch-download` 按钮和 handler<br>6. `showResult` 支持 `urlBatchMode`<br>7. `validateConversion` 复用文件转换的函数<br>8. `reset-btn` 重置 `urlBatchMode` |

## 验证方法

1. 添加 3 个 URL，批量转换 → 确认批量总结显示、不显示单个预览
2. 单个 URL 转换 → 确认预览正常显示
3. 转换失败的 URL → 确认错误详情显示
4. 批量转换后点击下载 → 确认 ZIP 包正确
5. 切换到文件 tab 再切回 URL tab → 确认状态保留
