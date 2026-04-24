# URL Batch Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 让 URL 转换拥有与文件转换一致的功能：质量校验、批量模式、批量总结、批量下载。

**Architecture:** 纯前端变更，所有逻辑在 `static/index.html` 的 `<script>` 中实现。`urlQueue` 每个条目新增 `result` 和 `errorMsg` 字段，复用文件转换的 `validateConversion` 函数。

**Tech Stack:** Vanilla JS, JSZip (已有 CDN)

---

## File to Modify

- `D:\myproject\1\markitdown-web\static\index.html`

---

## Task 1: 扩展 `urlQueue` 条目结构 & 新增 `urlBatchMode` 变量

**Files:**
- Modify: `static/index.html:420-422`

- [ ] **Step 1: 添加 `urlBatchMode` 变量和 `urlQueue` 条目扩展注释**

在变量声明区修改：
```javascript
let urlQueue = [];
let urlBatchMode = false;  // 新增：标识 URL 批量转换模式
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat: add urlBatchMode variable"
```

---

## Task 2: 修改 `addUrlToQueue` — 条目增加 `result` 和 `errorMsg`

**Files:**
- Modify: `static/index.html:750-753`

- [ ] **Step 1: 修改 `addUrlToQueue` 函数**

```javascript
function addUrlToQueue(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  if (!urlQueue.some(u => u.url === url)) {
    urlQueue.push({ url, status: 'pending', result: null, errorMsg: null });  // 新增 result, errorMsg
    renderUrlList();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat(url): add result and errorMsg to urlQueue items"
```

---

## Task 3: 修改 `url-convert` handler — 批量模式 + 质量校验 + 错误详情 + batch 参数传递

**Files:**
- Modify: `static/index.html:781-812` (`url-convert` click handler)

- [ ] **Step 1: 完整重写 `url-convert` handler**

将原来的：
```javascript
document.getElementById('url-convert').addEventListener('click', async () => {
  const pending = urlQueue.filter(u => u.status === 'pending');
  if (pending.length === 0) return;

  showLoading(true);
  for (const item of pending) {
    const index = urlQueue.indexOf(item);
    urlQueue[index].status = 'converting';
    renderUrlList();

    try {
      const formData = new FormData();
      formData.append('url', item.url);
      formData.append('keep_data_uris', document.getElementById('url-keep-uris').checked);

      const resp = await fetch(API + '/convert/url', { method: 'POST', body: formData });
      const data = await resp.json();

      if (data.success) {
        urlQueue[index].status = 'done';
        urlQueue[index].result = data;
        showResult(data.markdown, data.meta);
      } else {
        urlQueue[index].status = 'fail';
      }
    } catch (e) {
      urlQueue[index].status = 'fail';
    }
    renderUrlList();
  }
  showLoading(false);
});
```

替换为：
```javascript
document.getElementById('url-convert').addEventListener('click', async () => {
  const pending = urlQueue.filter(u => u.status === 'pending');
  if (pending.length === 0) return;

  urlBatchMode = pending.length > 1;
  showLoading(true);
  document.getElementById('batch-summary').style.display = 'none';

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  for (const item of pending) {
    const index = urlQueue.indexOf(item);
    urlQueue[index].status = 'converting';
    urlQueue[index].errorMsg = null;
    renderUrlList();

    try {
      const formData = new FormData();
      formData.append('url', item.url);
      formData.append('keep_data_uris', document.getElementById('url-keep-uris').checked);
      formData.append('batch', urlBatchMode);  // 传递 batch 参数

      const resp = await fetch(API + '/convert/url', { method: 'POST', body: formData });
      const data = await resp.json();

      if (data.success) {
        const isValid = validateConversion(data.markdown, item.url);
        if (isValid) {
          urlQueue[index].status = 'done';
          urlQueue[index].result = data;
          successCount++;
        } else {
          urlQueue[index].status = 'fail';
          urlQueue[index].errorMsg = '转换质量异常（内容乱码或过短）';
          failCount++;
        }
      } else {
        urlQueue[index].status = 'fail';
        urlQueue[index].errorMsg = data.detail || '转换失败';
        failCount++;
      }
    } catch (e) {
      urlQueue[index].status = 'fail';
      urlQueue[index].errorMsg = e.message || '网络错误';
      failCount++;
    }
    renderUrlList();
  }

  showLoading(false);

  // 批量模式显示总结，单个 URL 显示预览
  if (urlBatchMode) {
    showUrlBatchSummary(successCount, failCount, Date.now() - startTime);
    document.getElementById('url-batch-download').style.display = successCount > 0 ? 'inline-flex' : 'none';
    updateUrlBatchDownloadCount();
  } else {
    // 单个 URL 预览
    const doneItem = urlQueue.find(u => u.status === 'done');
    if (doneItem && doneItem.result) {
      showResult(doneItem.result.markdown, doneItem.result.meta);
    }
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat(url): add batch mode, quality validation, error details, and batch param"
```

---

## Task 4: 新增 `showUrlBatchSummary` 函数

**Files:**
- Modify: `static/index.html` (在 `showBatchSummary` 函数附近新增)

- [ ] **Step 1: 在 `showBatchSummary` 函数后添加 `showUrlBatchSummary`**

在 `showBatchSummary` 函数结束后（第 686 行附近）添加：

```javascript
function showUrlBatchSummary(success, failed, durationMs) {
  const elapsed = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
  const failedItems = urlQueue.filter(u => u.status === 'fail');

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
        <span class="stat-label">成功</span>
      </div>
      <div class="batch-stat error">
        <span class="stat-value">${failed}</span>
        <span class="stat-label">失败</span>
      </div>
    </div>`;

  if (failedItems.length > 0) {
    html += `<div class="batch-failed-list">`;
    failedItems.forEach(u => {
      html += `<div class="failed-item">
        <span class="failed-icon">!</span>
        <span>${truncateUrl(u.url)}</span>
      </div>
      <div class="batch-failed-reason">${u.errorMsg || '未知错误'}</div>`;
    });
    html += `</div>`;
  }

  document.getElementById('batch-summary').innerHTML = html;
  document.getElementById('batch-summary').style.display = 'block';
}
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat(url): add showUrlBatchSummary function"
```

---

## Task 5: 修改 `showResult` 支持 `urlBatchMode`

**Files:**
- Modify: `static/index.html:845-866`

- [ ] **Step 1: 修改 `showResult` 函数开头**

找到：
```javascript
function showResult(markdown, meta) {
  currentMarkdown = markdown;

  // 批量模式下不显示单个预览
  if (isBatchMode) return;
```

改为：
```javascript
function showResult(markdown, meta) {
  currentMarkdown = markdown || currentMarkdown;

  // 批量模式下不显示单个预览
  if (isBatchMode || urlBatchMode) return;
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat(url): showResult respects urlBatchMode"
```

---

## Task 6: 修改 `renderUrlList` — 显示错误详情

**Files:**
- Modify: `static/index.html:756-769`

- [ ] **Step 1: 修改 `renderUrlList` 函数，让失败条目可点击显示错误**

```javascript
function renderUrlList() {
  const list = document.getElementById('url-list');
  if (urlQueue.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = urlQueue.map((u, i) => `
    <div class="url-item">
      <span class="url-status ${u.status}">${u.status === 'pending' ? '' : u.status === 'done' ? '✓' : '!'}</span>
      <span class="url-text" title="${u.url}">${truncateUrl(u.url)}</span>
      ${u.status === 'fail' && u.errorMsg ? `<span class="url-error-hint" title="${u.errorMsg}" style="color: var(--error); font-size: 0.75rem; cursor: help;">(?)</span>` : ''}
      <span class="url-remove" onclick="removeUrl(${i})">✕</span>
    </div>
  `).join('');
}
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat(url): renderUrlList shows error hint for failed items"
```

---

## Task 7: 新增 `url-batch-download` 按钮和 handler

**Files:**
- Modify: `static/index.html:362-366` (在 url-convert button 后添加下载按钮)
- Modify: `static/index.html` (在 `updateBatchDownloadCount` 函数后添加 `updateUrlBatchDownloadCount` 和 handler)

- [ ] **Step 1: 在 URL tab 的 convert 按钮后添加批量下载按钮**

在第 366 行后添加：
```html
<button class="btn btn-success" id="url-batch-download" style="margin-top: 16px; display: none;">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  下载已转换 (0)
</button>
```

- [ ] **Step 2: 在 `updateBatchDownloadCount` 函数后（第 542 行附近）添加 URL 版本**

```javascript
function updateUrlBatchDownloadCount() {
  const doneCount = urlQueue.filter(u => u.status === 'done' && u.result).length;
  const btn = document.getElementById('url-batch-download');
  if (btn) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 下载已转换 (${doneCount})`;
  }
}
```

- [ ] **Step 3: 添加 `url-batch-download` click handler（在 `batch-download` handler 后）**

```javascript
document.getElementById('url-batch-download').addEventListener('click', async () => {
  const done = urlQueue.filter(u => u.status === 'done' && u.result);
  if (done.length === 0) return;

  if (done.length === 1) {
    const item = done[0];
    const blob = new Blob([item.result.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (item.result.filename || 'url_output') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const zip = new JSZip();
  for (const item of done) {
    const filename = (item.result.filename || 'url_output') + '.md';
    zip.file(filename, item.result.markdown);
  }

  try {
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `url_converted_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    showError('打包下载失败: ' + e.message);
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add static/index.html && git commit -m "feat(url): add batch download button and handler"
```

---

## Task 8: reset-btn 重置 `urlBatchMode` 和 URL 队列状态

**Files:**
- Modify: `static/index.html:554-562`

- [ ] **Step 1: 修改 reset-btn handler**

找到：
```javascript
document.getElementById('reset-btn').addEventListener('click', () => {
  fileQueue = [];
  isBatchMode = false;
  currentMarkdown = '';
  document.getElementById('result').classList.remove('show');
  document.getElementById('batch-summary').style.display = 'none';
  document.getElementById('reset-btn').style.display = 'none';
  renderFileList();
});
```

改为：
```javascript
document.getElementById('reset-btn').addEventListener('click', () => {
  fileQueue = [];
  urlQueue = [];
  isBatchMode = false;
  urlBatchMode = false;
  currentMarkdown = '';
  document.getElementById('result').classList.remove('show');
  document.getElementById('batch-summary').style.display = 'none';
  document.getElementById('reset-btn').style.display = 'none';
  document.getElementById('url-batch-download').style.display = 'none';
  renderFileList();
  renderUrlList();
});
```

- [ ] **Step 2: Commit**

```bash
git add static/index.html && git commit -m "feat(url): reset-btn clears urlQueue and urlBatchMode"
```

---

## Self-Review Checklist

1. **Spec coverage:** 所有 spec 中的功能都有对应 task 实现 ✅
2. **Placeholder scan:** 无 TODO/TBD/placeholder ✅
3. **Type consistency:** `urlQueue` 条目字段统一为 `url`, `status`, `result`, `errorMsg` ✅
4. **Spec gaps:** 无遗漏 ✅
