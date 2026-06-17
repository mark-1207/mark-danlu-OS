"""周报测试

- weekly_report(runs, feedback) → Markdown
- 包含：本周写了什么 / 评分趋势 / 沉淀统计 / 下周建议
"""
from __future__ import annotations

from datetime import datetime, timezone

from lu.feedback.models import Feedback
from lu.pipeline.models import Context
from lu.report.weekly import weekly_report


def _run(
    run_id: str,
    proposition: str,
    passed: bool = True,
    weakest: str = "温度",
    cases: int = 1,
    quotes: int = 2,
    insights: int = 1,
) -> Context:
    from lu.polish.models import DimensionScore, QualityReport
    from lu.sediment.models import Harvested
    from lu.blueprint.models import Case, Quote
    from lu.sediment.models import Insight

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
        harvested=Harvested(
            cases=[Case(title=f"case{i}", summary="s") for i in range(cases)],
            quotes=[Quote(text=f"q{i}", author="a") for i in range(quotes)],
            insights=[Insight(text=f"i{i}", source="draft") for i in range(insights)],
        ),
    )


class TestWeekly:
    def test_weekly_with_runs(self) -> None:
        from lu.polish.models import DimensionScore, QualityReport
        from lu.blueprint.models import Case, Quote
        from lu.sediment.models import Harvested, Insight

        def _custom_run(run_id, weakest_name):
            scores = {
                "温度": 8.0, "热度": 8.0, "深度": 8.0, "厚度": 8.0,
                "情绪曲线": 8.0, "知识迁移": 8.0,
                "观点锐度": 8.0, "思想模型应用": 8.0, "事实准确性": 8.0,
            }
            scores[weakest_name] = 5.0
            dims = [DimensionScore(name=n, score=s, details={}, suggestions=[]) for n, s in scores.items()]
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
                harvested=Harvested(
                    cases=[Case(title="c", summary="s")],
                    quotes=[Quote(text="q", author="a")],
                    insights=[Insight(text="i", source="draft")],
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
        report = weekly_report(runs, feedback, period="本周")
        assert "本周" in report
        assert "Run" in report or "run" in report.lower()
        assert "温度" in report
        assert "深度" in report

    def test_weekly_empty(self) -> None:
        report = weekly_report([], [], period="本周")
        assert "本周" in report
        assert "0" in report

    def test_weekly_counts_sediment(self) -> None:
        runs = [
            _run("r1", "x", cases=3, quotes=5, insights=2),
        ]
        report = weekly_report(runs, [], period="本周")
        # 沉淀统计
        assert "案例" in report or "cases" in report.lower()
        # 数字应在
        assert "3" in report or "5" in report
