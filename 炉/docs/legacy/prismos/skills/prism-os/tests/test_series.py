"""
M3b 系列模式 TDD 测试 (v1.1)

11 个测试覆盖 plan 行 1976-1988:
- suitability × 4 (yes_deep / no_news / no_shallow / outputs_reason)
- series_gen × 2 (three_titles / filter_low_tension)
- series_save / series_skip × 2
- series_id_unique × 1
- conflict_skips_same_series × 1
- mark_series_written × 1
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# 让 tests 能找到 scripts
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ============ Suitability 适配性分析 ============

class TestSuitability:
    """适配性分析：5 维 LLM 评估，含硬规则覆盖"""

    def test_suitability_yes_for_deep_topic(self):
        """深度话题（depth_potential=4, type_fit=4, persona_align=4, time=1） → suitable=true"""
        from series import analyze_suitability

        fake_llm_output = json.dumps({
            "suitable": True,
            "confidence": 0.85,
            "primary_reason": "话题深度足够撑 3+ 篇",
            "suggested_length": 3,
            "suggested_positioning": "deepen",
            "dimension_scores": {
                "depth_potential": 4,
                "topic_type_fit": 4,
                "time_sensitivity": 1,
                "persona_alignment": 4,
                "audience_breadth": 3,
            },
        }, ensure_ascii=False)

        with patch("series._call_llm_raw", return_value=fake_llm_output):
            result = analyze_suitability(
                thesis="AI 时代 35 岁程序员为什么焦虑",
                persona={"topic_domains": ["AI时代芸芸众生相", "认知升级"]},
            )

        assert result["suitable"] is True
        assert result["confidence"] >= 0.5

    def test_suitability_no_for_news(self):
        """时效新闻（time_sensitivity=5）→ 硬规则强制 unsuitable，即使 LLM 说 suitable"""
        from series import analyze_suitability

        fake_llm_output = json.dumps({
            "suitable": True,  # LLM 误判，硬规则必须覆盖
            "confidence": 0.9,
            "primary_reason": "看起来有展开空间",
            "suggested_length": 3,
            "suggested_positioning": "expand",
            "dimension_scores": {
                "depth_potential": 4,
                "topic_type_fit": 3,
                "time_sensitivity": 5,  # 极强时效 → 硬规则覆盖
                "persona_alignment": 3,
                "audience_breadth": 3,
            },
        }, ensure_ascii=False)

        with patch("series._call_llm_raw", return_value=fake_llm_output):
            result = analyze_suitability(
                thesis="今天 OpenAI 发布会发布了什么",
                persona={"topic_domains": ["AI时代芸芸众生相"]},
            )

        assert result["suitable"] is False, "time_sensitivity >= 4 必须强制 unsuitable"

    def test_suitability_no_for_shallow(self):
        """浅命题（depth_potential=2） → 硬规则强制 unsuitable"""
        from series import analyze_suitability

        fake_llm_output = json.dumps({
            "suitable": True,  # LLM 误判
            "confidence": 0.6,
            "primary_reason": "看起来可以展开",
            "suggested_length": 3,
            "suggested_positioning": "expand",
            "dimension_scores": {
                "depth_potential": 2,  # 太浅 → 硬规则覆盖
                "topic_type_fit": 4,
                "time_sensitivity": 1,
                "persona_alignment": 3,
                "audience_breadth": 3,
            },
        }, ensure_ascii=False)

        with patch("series._call_llm_raw", return_value=fake_llm_output):
            result = analyze_suitability(
                thesis="今天天气怎么样",
                persona={"topic_domains": []},
            )

        assert result["suitable"] is False, "depth_potential <= 2 必须强制 unsuitable"

    def test_suitability_outputs_reason(self):
        """primary_reason 非空，用户能看到"""
        from series import analyze_suitability

        fake_llm_output = json.dumps({
            "suitable": True,
            "confidence": 0.7,
            "primary_reason": "AI 时代认知升级是 persona 母题，可深可广",
            "suggested_length": 3,
            "suggested_positioning": "deepen",
            "dimension_scores": {
                "depth_potential": 4,
                "topic_type_fit": 4,
                "time_sensitivity": 2,
                "persona_alignment": 5,
                "audience_breadth": 3,
            },
        }, ensure_ascii=False)

        with patch("series._call_llm_raw", return_value=fake_llm_output):
            result = analyze_suitability(
                thesis="AI 时代认知升级",
                persona={"topic_domains": ["认知升级"]},
            )

        assert result["primary_reason"], "primary_reason 不能为空"
        assert isinstance(result["primary_reason"], str)


# ============ Series Generation 系列生成 ============

class TestSeriesGeneration:
    """3 标题生成 + positioning 分配 + 张力过滤"""

    def test_series_gen_three_titles(self):
        """生成 3 个不同 positioning 标签"""
        from series import generate_series_titles

        fake_titles = [
            {"title": "35 岁程序员转 AI 的真实代价是什么", "based_on": "core_claim_challenge", "tension_score": 4, "why": ""},
            {"title": "35 岁程序员焦虑根源不是 AI 是身份", "based_on": "hidden_assumption_reveal", "tension_score": 5, "why": ""},
            {"title": "35 岁程序员不学 AI 反而活得更好", "based_on": "contrarian_inversion", "tension_score": 4, "why": ""},
        ]

        with patch("series._reuse_title_deep_gen", return_value=fake_titles):
            titles = generate_series_titles(
                anchor_title="35 岁程序员，焦虑的不是 AI",
                anchor_thesis="AI 时代 35 岁程序员为什么焦虑",
                anchor_depth=None,
                persona={"avoid_keywords": ["鸡汤"]},
                count=3,
            )

        assert len(titles) == 3
        positionings = [t["positioning"] for t in titles]
        assert len(set(positionings)) == 3, "3 个 positioning 必须各不相同"
        assert set(positionings) == {"deepen", "expand", "contrarian"}

    def test_series_filter_low_tension(self):
        """张力 < 3 的标题被过滤；3 个全过滤则重试"""
        from series import generate_series_titles

        weak_then_strong = [
            # 第一次：全部张力 < 3
            [
                {"title": "AI 让 35 岁更焦虑了吗", "based_on": "x", "tension_score": 2, "why": ""},
                {"title": "35 岁怎么办呢", "based_on": "y", "tension_score": 1, "why": ""},
                {"title": "面对 AI 我们该怎么做", "based_on": "z", "tension_score": 2, "why": ""},
            ],
            # 重试：全部张力 >= 3
            [
                {"title": "35 岁程序员焦虑不是 AI 而是身份", "based_on": "a", "tension_score": 5, "why": ""},
                {"title": "35 岁的我决定停止学 AI", "based_on": "b", "tension_score": 4, "why": ""},
                {"title": "35 岁程序员的真正出路", "based_on": "c", "tension_score": 4, "why": ""},
            ],
        ]

        with patch("series._reuse_title_deep_gen", side_effect=weak_then_strong):
            titles = generate_series_titles(
                anchor_title="35 岁程序员",
                anchor_thesis="35 岁程序员为什么焦虑",
                anchor_depth=None,
                persona={"avoid_keywords": []},
                count=3,
            )

        # 重试后拿到 3 个张力 >= 3 的
        assert len(titles) == 3
        for t in titles:
            assert t["tension_score"] >= 3


# ============ Series ID 唯一性 ============

class TestSeriesId:
    """series_id 格式 + 同日同命题不冲突"""

    def test_series_id_format(self):
        """格式: series-YYYYMMDD-<slug>-<6 字符 nanoid>"""
        from series import make_series_id

        sid = make_series_id("AI 时代 35 岁程序员焦虑")
        # 格式校验
        assert sid.startswith("series-")
        parts = sid.split("-")
        assert len(parts) >= 4, f"series_id 至少 4 段，实得: {sid}"
        # 日期段是 8 位
        assert len(parts[1]) == 8 and parts[1].isdigit()
        # 最后一段是 6 字符 hex
        assert len(parts[-1]) == 6

    def test_series_id_unique(self):
        """同命题同日两次跑 → series_id 不同（防冲突）"""
        from series import make_series_id

        sid1 = make_series_id("AI 时代 35 岁程序员焦虑")
        sid2 = make_series_id("AI 时代 35 岁程序员焦虑")

        assert sid1 != sid2, "同命题两次生成必须不同（nanoid 防冲突）"


# ============ Conflict Detection 豁免 ============

class TestConflictExemption:
    """conflict_detect: 同 series_id 历史项不算冲突"""

    def test_conflict_skips_same_series(self):
        """同 series_id 的历史命题不算 thesis_collision"""
        from conflict_detect import detect_conflicts

        thesis = "AI 时代 35 岁程序员焦虑根源是什么"
        sid = "series-20260611-ai-35-abc123"

        history = [
            # 同 series_id，不算冲突
            {"thesis": "AI 时代 35 岁程序员焦虑的本质", "series_id": sid,
             "timestamp": datetime.now().isoformat()},
            # 不同 series_id，算冲突
            {"thesis": "AI 时代 35 岁程序员焦虑根源", "series_id": "series-other-xyz",
             "timestamp": datetime.now().isoformat()},
        ]

        result = detect_conflicts(
            thesis=thesis,
            history=history,
            current_series_id=sid,
        )
        thesis_titles = [c["thesis"] for c in result["thesis_collisions"]]
        # 同 series_id 的不应出现在冲突里
        assert all(sid not in t for t in thesis_titles)
        # 但不同 series_id 的高相似度命题应出现
        assert len(result["thesis_collisions"]) >= 1


# ============ Command Handling: s 保存 / q 跳过 ============

class TestSeriesCommands:
    """series.handle_series_command: s / 1-3 / m / q"""

    def test_series_save_creates_state(self):
        """`s` 触发 series 写入 → action='save_all'"""
        from series import handle_series_command

        state = {
            "series_id": "series-20260611-test-abc123",
            "titles": [
                {"title": "T2", "positioning": "deepen", "tension_score": 4},
                {"title": "T3", "positioning": "expand", "tension_score": 4},
                {"title": "T4", "positioning": "contrarian", "tension_score": 5},
            ],
        }
        result = handle_series_command("s", state)
        assert result["action"] == "save_all"

    def test_series_skip_continues_with_anchor(self):
        """`q` → action='skip'（只用锚点 T1 继续 CCOS）"""
        from series import handle_series_command

        state = {"series_id": "series-20260611-test-abc123", "titles": []}
        result = handle_series_command("q", state)
        assert result["action"] == "skip"


# ============ Storage: mark_series_written ============

class TestStorageSeriesAPI:
    """storage.mark_series_written: 更新 slot status"""

    def test_mark_series_written_updates_status(self):
        """调用后指定 slot status → 'written'，整 series.status → 'partial'"""
        from storage import mark_series_written

        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = os.path.join(tmpdir, "topic_log.yaml")
            # 注入 series 项
            initial = [{
                "thesis": "AI 时代 35 岁程序员焦虑",
                "selected_title": "35 岁程序员焦虑",
                "series": {
                    "series_id": "series-20260611-ai-test-abc123",
                    "status": "pending",
                    "anchor_title": "35 岁程序员焦虑",
                    "planned_titles": [
                        {"slot": 1, "title": "锚点", "status": "anchor"},
                        {"slot": 2, "title": "深入", "positioning": "deepen",
                         "tension_score": 4, "status": "pending"},
                        {"slot": 3, "title": "展开", "positioning": "expand",
                         "tension_score": 4, "status": "pending"},
                    ],
                },
                "timestamp": datetime.now().isoformat(),
            }]
            with open(log_path, "w", encoding="utf-8") as f:
                for item in initial:
                    f.write("  - " + json.dumps(item, ensure_ascii=False) + "\n")

            with patch("storage.get_data_dir", return_value=tmpdir):
                result = mark_series_written(
                    series_id="series-20260611-ai-test-abc123",
                    slot=2,
                )

            assert result["status"] == "ok"

            # 重新加载验证
            with open(log_path, "r", encoding="utf-8") as f:
                content = f.read()
            assert '"status": "written"' in content or '"status":"written"' in content
            assert '"status": "partial"' in content or '"status":"partial"' in content
