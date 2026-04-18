# 问题11：Resume 隔离性 — 设计方案

## 背景

ContentForge CLI 支持 `resume <runId>` 从断点恢复执行。但没有并发控制——如果同一 runId 被并行多次操作（如两个终端同时执行），会互相覆盖 context artifact 文件，导致数据混乱。

## 设计目标

**同一 runId 任何时刻只能被一个进程操作**，防止并发写入导致 artifact 覆盖。

## 方案：runId 级别文件锁

### 锁文件结构

路径：`output/{runId}/.lock`

```json
{
  "pid": 12345,
  "hostname": "DESKTOP-XXX",
  "startedAt": "2026-04-18T10:30:00.000Z",
  "command": "node dist/index.js recreate ..."
}
```

### 获取锁时机

| 命令 | 获取时机 | 释放时机 |
|------|----------|----------|
| `create` | `runCreate()` mkdir 后，pipeline.run() 前 | `finally` — pipeline 结束（成功/失败都释放） |
| `recreate` | `runRecreate()` mkdir 后，pipeline.run() 前 | `finally` — 整个 run 结束（包括交互式方向选择） |
| `resume` | `runResume()` context.restore() 前 | `finally` — resume 操作完成 |

### Stale Lock 处理

获取锁时检查已有 lock 文件：
1. 读取 lock 文件，获取 PID 和 hostname
2. 检查进程是否还在运行
   - Windows：`tasklist /FI "PID eq N" /NH`
   - Unix：`kill -0 N`
3. 如果进程已死（不存在或不可访问）→ stale lock，直接覆盖
4. 如果进程存活 → 抛出错误，拒绝获取锁

### 锁冲突报错

```
错误: Run "recreate_1744963200000" is already locked by PID 12345
(node dist/index.js recreate ...) on DESKTOP-XXX.
Use "resume list" to check running processes, or manually delete
output/recreate_1744963200000/.lock if the process has crashed.
```

### 实现位置

`src/utils/run-lock.ts` — 独立工具函数，导出：
- `acquireRunLock(runId, outputDir): Promise<RunLock>`
- `releaseRunLock(runId, outputDir): Promise<void>`

CLI 命令在适当位置调用，核心逻辑不侵入 pipeline 或 context。

## 边界情况

1. **进程正常退出但锁未释放**：process.exit() 前 OS 会自动关闭文件句柄，锁文件仍存在但下次获取时会检测到 stale 并覆盖
2. **机器重启**：锁文件残留，下次获取时一定检测为 stale（PID 不存在）
3. **不同机器操作同一个 runId（共享存储）**：hostname 不同，但各自只能检测本地 PID，理论上可能两边都认为对方是 stale → **不处理**，依赖共享存储的写入原子性保护

## 实施步骤

1. 新建 `src/utils/run-lock.ts`
2. `create.ts` — mkdir 后调用 `acquireRunLock`，finally 中 `releaseRunLock`
3. `recreate.ts` — 同上
4. `resume.ts` — restore 前调用 `acquireRunLock`，finally 中 `releaseRunLock`
5. 端到端测试：启动一个 recreate，Ctrl+Z 挂起，再开另一个终端 resume 同 runId，验证报错
