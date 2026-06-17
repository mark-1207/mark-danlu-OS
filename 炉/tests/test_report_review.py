"""复盘测试

- review(runs, feedback) → Markdown 报告
- 包含：总 run 数、通过率、弱维度分布、forbidden 命中
- 空数据时返回合理默认
"""
from __future__ import annotations

from datetime import datetime, timezone

from lu.feedback.models import Feedback
from lu.pipeline.models import Context
from lu.polish.models import DimensionScore, QualityReport
from lu.report.review import review


def _make_run(
    run_id: str,
    proposition: str,
    passed: bool,
    weakest: str = "温度",
    created_at: datetime | None = None,
) -> Context:
    """构造一个最小 Context（用于 review 测试）"""
    dims = [
        DimensionScore(name=d, score=8.0 if passed else 6.0, details={}, suggestions=[])
        for d in ["温度", "热度", "深度", "厚度", "情绪曲线", "知识迁移",
                  "观点锐度", "思想模型应用", "事实准确性"]
    ]
    return Context(
        run_id=run_id,
        proposition_cleaned=proposition,
        state="completed",
        quality_report=QualityReport(
            temperature=dims[0], heat=dims[1], depth=dims[2], thickness=dims[3],
            emotion_curve=dims[4], knowledge_transfer=dims[5],
            viewpoint_sharpness=dims[6], thinking_model_application=dims[7],
            factual_accuracy=dims[8],
        ),
    )


class TestReview:
    def test_review_with_runs_and_feedback(self) -> None:
        # 手动构造 runs 让 weakest_dimension 不同
        from lu.polish.models import DimensionScore, QualityReport

        def _custom_run(run_id, weakest_score_name):
            scores = {
                "温度": 8.0, "热度": 8.0, "深度": 8.0, "厚度": 8.0,
                "情绪曲线": 8.0, "知识迁移": 8.0,
                "观点锐度": 8.0, "思想模型应用": 8.0, "事实准确性": 8.0,
            }
            scores[weakest_score_name] = 5.0
            dims = [
                DimensionScore(name=n, score=s, details={}, suggestions=[])
                for n, s in scores.items()
            ]
            return Context(
                run_id=run_id,
                proposition_cleaned=run_id,
                state="completed",
                quality_report=QualityReport(
                    temperature=dims[0], heat=dims[1], depth=dims[2], thickness=dims[3],
                    emotion_curve=dims[4], knowledge_transfer=dims[5],
                    viewpoint_sharpness=dims[6], thinking_model_application=dims[7],
                    factual_accuracy=dims[8],
                ),
            )

        runs = [
            _custom_run("r1", "温度"),
            _custom_run("r2", "深度"),
        ]
        feedback = [
            Feedback(run_id="r1", proposition="r1", quality_overall_passed=False, weakest_dimension="温度"),
            Feedback(run_id="r2", proposition="r2", quality_overall_passed=False, weakest_dimension="深度"),
        ]
        report = review(runs, feedback, period="all")
        assert "Run" in report
        assert "深度" in report
        assert "温度" in report

    def test_review_empty_data(self) -> None:
        report = review([], [], period="all")
        assert "0" in report
        assert "无" in report or "暂无" in report

    def test_review_counts_pass_rate(self) -> None:
        runs = [
            _make_run("r1", "a", passed=True),
            _make_run("r2", "b", passed=False),
            _make_run("r3", "c", passed=True),
        ]
        feedback = []
        report = review(runs, feedback, period="all")
        # 2/3 = 67%
        assert "67%" in report or "2/3" in report or "66%" in report
