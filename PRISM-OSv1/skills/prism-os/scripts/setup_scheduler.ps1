# PRISM-OS Phase 6 自动同步任务安装脚本
#
# 用法（PowerShell 管理员）：
#   powershell -ExecutionPolicy Bypass -File setup_scheduler.ps1
#
# 功能：
#   - 创建 Windows 计划任务，每天 03:00 自动跑 metrics_sync.py + template_scorer.py
#   - 任务名：PRISM-OS Metrics Sync
#   - 日志写入 D:\myproject\PRISM-OSv1\logs\metrics_sync.log

$taskName = "PRISM-OS Metrics Sync"
$scriptPath = "D:\myproject\PRISM-OSv1\skills\prism-os\scripts\metrics_sync_wrapper.bat"
$logDir = "D:\myproject\PRISM-OSv1\logs"

# 创建日志目录
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

# 创建 wrapper bat（先后跑 sync + score，输出到日志）
$batContent = @"
@echo off
set LOGFILE=$logDir\metrics_sync.log
set PYTHONPATH=D:\myproject\PRISM-OSv1\skills\prism-os\scripts
echo === %date% %time% 开始同步 === >> %LOGFILE%
cd /d D:\myproject\PRISM-OSv1\skills\prism-os\scripts
python prism_os.py metrics sync >> %LOGFILE% 2>&1
echo === sync 完成 === >> %LOGFILE%
python prism_os.py metrics score >> %LOGFILE% 2>&1
echo === score 完成 === >> %LOGFILE%
echo. >> %LOGFILE%
"@

Set-Content -Path $scriptPath -Value $batContent -Encoding ASCII
Write-Host "✓ Wrapper 脚本已创建: $scriptPath"

# 删除旧任务（如果存在）
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "✓ 已删除旧任务: $taskName"
}

# 创建新任务：每天 03:00 运行
$action = New-ScheduledTaskAction -Execute $scriptPath
$trigger = New-ScheduledTaskTrigger -Daily -At "03:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "PRISM-OS Phase 6 自动同步任务：每天 03:00 跑 metrics sync + score" | Out-Null

Write-Host ""
Write-Host "✓ 计划任务创建成功: $taskName"
Write-Host "  触发时间: 每天 03:00"
Write-Host "  日志路径: $logDir\metrics_sync.log"
Write-Host ""
Write-Host "查看任务: Get-ScheduledTask -TaskName '$taskName'"
Write-Host "立即运行: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "删除任务: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
