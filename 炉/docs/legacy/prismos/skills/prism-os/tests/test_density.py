"""
M10 C2 信息密度控制 TDD 测试 (v1.1)

8 个测试覆盖 plan 行 2539-2548:
- 定量实体计数
- 定性 LLM 2 项检查
- 段落级密度
- LLM 调用次数
- quality_check 集成
"""
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ============ 定量：实体计数 ============

class TestDensityQuantitative:
    """count_entities + quantitative_density: 0 LLM 定量计数"""

    def test_density_quantitative(self):
        """数字+年份+百分比计数正确"""
        from density import count_entities, quantitative_density

        text = "2024 年 GDP 增长 5.2%，全国有 14 亿人口，其中 35% 是年轻人"
        entities = count_entities(text)
        assert entities >= 3, f"至少应识别 3 个实体，实际: {entities}"

        density = quantitative_density(text)
        assert 0.0 < density <= 100.0

    def test_density_empty_text(self):
        """空文本不崩溃"""
        from density import quantitative_density

        assert quantitative_density("") == 0.0
        assert quantitative_density("没有数字的文本") >= 0.0


# ============ 定性：LLM 2 项检查 ============

class TestDensityQualitative:
    """measure_density: LLM 2 项核心检查"""

    def test_density_logic_chain(self):
        """logic_chain_covered 检查"""
        from density import measure_density

        fake_llm_output = '{"logic_chain_covered": true, "value_increment_found": false, "low_density_paragraphs": [], "high_density_paragraphs": [], "suggestions": []}'
        with patch("density._call_llm_raw", return_value=fake_llm_output):
            report = measure_density("测试文本 2024 年增长 5%", {})
        assert report.logic_chain_covered is True

    def test_density_value_increment(self):
        """value_increment_found 检查"""
        from density import measure_density

        fake_llm_output = '{"logic_chain_covered": false, "value_increment_found": true, "low_density_paragraphs": [], "high_density_paragraphs": [], "suggestions": ["增加数据"]}'
        with patch("density._call_llm_raw", return_value=fake_llm_output):
            report = measure_density("测试文本", {})
        assert report.value_increment_found is True

    def test_density_low_high_paragraphs(self):
        """段落级密度：low/high paragraph 列表"""
        from density import measure_density

        fake_llm_output = '{"logic_chain_covered": true, "value_increment_found": true, "low_density_paragraphs": ["第2段"], "high_density_paragraphs": ["第1段"], "suggestions": []}'
        with patch("density._call_llm_raw", return_value=fake_llm_output):
            report = measure_density("段落一\n\n段落二", {})
        assert "第2段" in report.low_density_paragraphs
        assert "第1段" in report.high_density_paragraphs

    def test_density_suggestions(self):
        """suggestions 非空（有建议）"""
        from density import measure_density

        fake_llm_output = '{"logic_chain_covered": false, "value_increment_found": false, "low_density_paragraphs": [], "high_density_paragraphs": [], "suggestions": ["增加具体数据", "补充案例"]}'
        with patch("density._call_llm_raw", return_value=fake_llm_output):
            report = measure_density("测试文本", {})
        assert len(report.suggestions) >= 1

    def test_density_llm_called_once(self):
        """1 次 LLM 调用（2 项检查合并在 1 个 prompt）"""
        from density import measure_density

        call_count = [0]
        def mock_llm(prompt, **kwargs):
            call_count[0] += 1
            return '{"logic_chain_covered": true, "value_increment_found": true, "low_density_paragraphs": [], "high_density_paragraphs": [], "suggestions": []}'

        with patch("density._call_llm_raw", side_effect=mock_llm):
            measure_density("测试文本", {})

        assert call_count[0] == 1


# ============ 集成 ============

class TestDensityIntegration:
    """密度检查与 quality_check 集成"""

    def test_check_l6_density_returns_dict(self):
        """check_l6_density 返回完整 dict"""
        from density import check_l6_density, DensityReport

        report = DensityReport(
            overall_density=0.6,
            quantitative_score=0.7,
            qualitative_score=0.5,
            logic_chain_covered=True,
            value_increment_found=True,
            low_density_paragraphs=["第3段"],
            high_density_paragraphs=["第1段"],
            suggestions=["增加数据"],
        )
        result = check_l6_density(report)
        assert "overall_density" in result
        assert "suggestions" in result
        assert result["logic_chain_covered"] is True
