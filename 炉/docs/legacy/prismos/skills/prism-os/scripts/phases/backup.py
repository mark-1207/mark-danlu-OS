"""Phase 1.5: 备选检查 + M3 冲突检测"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
from datetime import datetime


class BackupCheckPhase(Phase):
    """Phase 1.5: 检查同主题草稿 + M3 冲突检测（A 命题 / C 受众）"""

    @property
    def name(self) -> str:
        return "backup_check"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return state.intent is not None and state.intent.get("trigger")

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from assassin import check_related_backups
        from conflict_detect import detect_conflicts
        from storage import load_log

        # 1) 备选检查（原逻辑）
        try:
            backups = check_related_backups(state.thesis)
        except Exception as e:
            backups = []

        # 2) M3 冲突检测：从 topic_log 读历史
        try:
            history = load_log(limit=50) or []
            # 转成 conflict_detect 期望的格式
            history_normalized = []
            for h in history:
                # h 是 topic_log 格式，含 thesis/cumulative_count
                # 缺受众字段，留空（受众疲劳不检）
                history_normalized.append({
                    "thesis": h.get("thesis", ""),
                    "title": h.get("selected_title", ""),
                    "audience": "",  # topic_log 不存受众，留空
                    "timestamp": h.get("timestamp", ""),
                })
            # 用 audience 字段（从 intent 拿或留空）
            audience = ""
            try:
                if hasattr(state, "intent") and state.intent:
                    audience = state.intent.get("audience", "")
            except Exception:
                pass
            conflicts = detect_conflicts(
                state.thesis, history_normalized,
                audience=audience,
                now=datetime.now(),
            )
        except Exception as e:
            conflicts = {
                "thesis_collisions": [],
                "angle_collisions": [],
                "audience_fatigue": {"level": "none", "count": 0, "audience": ""},
                "data_collisions": {"enabled": False, "note": f"v1 暂不支持 ({e})"},
                "lookback_days": 30,
            }

        return PhaseResult(status="success", data={
            "backup_matches": backups,
            "conflict_report": conflicts,
        })

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        matches = result.data.get("backup_matches", [])
        if matches:
            print(f"[Phase 1.5] 备选: {len(matches)} 个匹配", file=sys.stderr)

        # M3: 显示冲突报告
        conflicts = result.data.get("conflict_report", {})
        if conflicts:
            tcs = conflicts.get("thesis_collisions", [])
            af = conflicts.get("audience_fatigue", {})
            if tcs:
                print(f"[Phase 1.5] ⚠ 命题撞车: {len(tcs)} 条（最近 30 天）", file=sys.stderr)
            if af.get("level") in ("warn", "high"):
                print(f"[Phase 1.5] ⚠ 受众疲劳: {af['count']} 篇（{af.get('audience', '?')}）", file=sys.stderr)
