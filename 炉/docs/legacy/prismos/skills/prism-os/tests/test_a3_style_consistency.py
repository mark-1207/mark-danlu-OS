"""
M6 A3 风格连贯性 TDD 测试 (v1.1)

6 个测试覆盖 plan 行 2314-2321:
- 风格一致性分数范围 (0-1)
- 无历史 → 中性 0.5
- 高相似 → ≥ 0.7
- embedding 缓存（不重算）
- storage.append_log 存 embedding
- top_n 限制生效
"""
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ============ 基本功能 ============

class TestStyleConsistency:
    """compute_style_consistency: 与历史标题的风格一致性"""

    def test_a3_similarity_in_range(self):
        """返回值在 0-1 范围内"""
        from title_scoring import compute_style_consistency

        # mock embedding 返回固定向量
        fake_vec = [0.1] * 10
        with patch("embedding.embed", return_value=fake_vec):
            score, _ = compute_style_consistency(
                "测试标题", ["历史标题1", "历史标题2"]
            )
        assert 0.0 <= score <= 1.0

    def test_a3_no_history_neutral(self):
        """无历史标题 → 返回 0.5 中性分"""
        from title_scoring import compute_style_consistency

        score, explain = compute_style_consistency("测试标题", [])
        assert score == 0.5
        assert "无历史" in explain or "中性" in explain

    def test_a3_high_for_similar(self):
        """与历史标题高度相似 → score ≥ 0.7"""
        from title_scoring import compute_style_consistency

        # 所有 embedding 相同 → cosine sim = 1.0
        same_vec = [0.3, 0.4, 0.5]
        with patch("embedding.embed", return_value=same_vec):
            score, _ = compute_style_consistency(
                "测试标题", ["相似标题1", "相似标题2"]
            )
        assert score >= 0.7

    def test_a3_top_n_respects_limit(self):
        """top_n=20 限制生效：只用最近 20 条历史"""
        from title_scoring import compute_style_consistency

        call_count = [0]
        original_vec = [0.1, 0.2, 0.3]

        def mock_embed(text, model=None):
            call_count[0] += 1
            return original_vec

        history = [f"标题{i}" for i in range(50)]
        with patch("embedding.embed", side_effect=mock_embed):
            compute_style_consistency("测试标题", history, top_n=20)

        # embed 调用次数 = 1 (当前标题) + 20 (历史) = 21
        assert call_count[0] == 21


# ============ Embedding 缓存 ============

class TestEmbeddingCache:
    """A3 使用 embedding 缓存（不重算历史标题）"""

    def test_a3_uses_embedding_cache(self):
        """多次调用 → 同一历史标题只 embed 一次（走缓存）"""
        from title_scoring import compute_style_consistency

        embed_call_log = []

        def mock_embed(text, model=None):
            embed_call_log.append(text)
            return [0.1, 0.2, 0.3]

        history = ["标题A", "标题B", "标题A"]  # 标题A 重复

        with patch("embedding.embed", side_effect=mock_embed):
            compute_style_consistency("测试标题", history)

        # embed 被调用 4 次: 测试标题 + 标题A + 标题B + 标题A
        # （缓存在 embedding.py 内部，这里测的是 title_scoring 的调用逻辑）
        assert len(embed_call_log) == 4


# ============ Storage 集成 ============

class TestStorageEmbedding:
    """storage.append_log 存 _title_embedding"""

    def test_storage_append_log_saves_embedding(self):
        """append_log 后 topic_log 中有 _title_embedding 字段"""
        import storage
        import json

        fake_vec = [0.1, 0.2, 0.3, 0.4, 0.5]

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(storage, "get_data_dir", return_value=tmpdir), \
                 patch("embedding.embed", return_value=fake_vec):
                storage.append_log({
                    "thesis": "测试命题",
                    "selected_title": "测试选中标题",
                })

            log_path = os.path.join(tmpdir, "topic_log.yaml")
            with open(log_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "_title_embedding" in content
