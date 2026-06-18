"""CLI embed/recall 子命令测试"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from lu.cli.embedding import cmd_embed, cmd_recall, build_parser
from lu.embedding.index import EmbeddingIndex
from lu.embedding.types import EmbeddingResult
from lu.llm.errors import LLMError


def _fake_chain_with_vec(vec: list[float]):
    """构造一个 EmbeddingChain-like 对象，返回固定 vec"""
    from lu.embedding.chain import EmbeddingChain

    def _p(text: str) -> EmbeddingResult:
        return EmbeddingResult(embedding=list(vec), model="m", tokens=len(text))

    return EmbeddingChain([_p])


def _args(**kwargs) -> object:
    """简单 Namespace 构造"""
    import argparse
    base = {
        "text": "x",
        "top_k": 3,
        "kind": None,
        "propositions": "config/embeddings/propositions.jsonl",
        "materials": "config/embeddings/materials.jsonl",
        "threshold": 0.7,
        "model": "text-embedding-3-small",
    }
    base.update(kwargs)
    return argparse.Namespace(**base)


class TestCmdEmbed:
    def test_prints_dim_and_vector(self, tmp_path: Path, capsys) -> None:
        vec = [0.1, 0.2, 0.3, 0.4]
        chain = _fake_chain_with_vec(vec)
        with patch("lu.cli.embedding.EmbeddingFactory.from_env", return_value=chain):
            args = _args(text="hello", propositions=str(tmp_path / "p.jsonl"))
            rc = cmd_embed(args)
        assert rc == 0
        captured = capsys.readouterr()
        # stdout: JSON 含 dim
        data = json.loads(captured.out.strip())
        assert data["dim"] == 4
        assert data["preview"] == [0.1, 0.2, 0.3, 0.4]
        # stderr: 提示信息
        assert "dim=4" in captured.err

    def test_no_api_key_returns_error(self, tmp_path: Path, capsys) -> None:
        with patch(
            "lu.cli.embedding.EmbeddingFactory.from_env",
            side_effect=LLMError("no key", code="AUTH"),
        ):
            args = _args(text="hello", propositions=str(tmp_path / "p.jsonl"))
            rc = cmd_embed(args)
        assert rc == 2
        err = capsys.readouterr().err
        assert "AUTH" in err or "API" in err or "key" in err.lower()


class TestCmdRecall:
    def test_prints_top_k_hits(self, tmp_path: Path, capsys) -> None:
        # 预先建好素材索引
        mat_idx = EmbeddingIndex(tmp_path / "m.jsonl")
        mat_idx.add(id="c1", kind="case", text="案例1", embedding=[1.0, 0.0], source="s")
        mat_idx.add(id="c2", kind="quote", text="金句1", embedding=[0.0, 1.0], source="s")
        chain = _fake_chain_with_vec([1.0, 0.0])
        with patch("lu.cli.embedding.EmbeddingFactory.from_env", return_value=chain):
            args = _args(
                text="q",
                materials=str(tmp_path / "m.jsonl"),
                top_k=2,
                threshold=-1.0,  # echo chain 算的不是真相似度
            )
            rc = cmd_recall(args)
        assert rc == 0
        out = capsys.readouterr().out
        assert "案例1" in out
        # threshold=-1.0 包含全部
        # c1 cosine=1, c2 cosine=0 → 都通过

    def test_kind_filter(self, tmp_path: Path, capsys) -> None:
        mat_idx = EmbeddingIndex(tmp_path / "m.jsonl")
        mat_idx.add(id="c1", kind="case", text="案例1", embedding=[1.0, 0.0], source="s")
        mat_idx.add(id="q1", kind="quote", text="金句1", embedding=[1.0, 0.0], source="s")
        chain = _fake_chain_with_vec([1.0, 0.0])
        with patch("lu.cli.embedding.EmbeddingFactory.from_env", return_value=chain):
            args = _args(
                text="q",
                materials=str(tmp_path / "m.jsonl"),
                kind="quote",
                top_k=5,
                threshold=-1.0,
            )
            rc = cmd_recall(args)
        assert rc == 0
        out = capsys.readouterr().out
        assert "金句1" in out
        assert "案例1" not in out

    def test_no_hits_prints_empty(self, tmp_path: Path, capsys) -> None:
        chain = _fake_chain_with_vec([1.0, 0.0])
        with patch("lu.cli.embedding.EmbeddingFactory.from_env", return_value=chain):
            args = _args(
                text="q",
                materials=str(tmp_path / "m.jsonl"),
                threshold=0.99,
            )
            rc = cmd_recall(args)
        assert rc == 0
        out = capsys.readouterr().out
        assert "无召回" in out or "empty" in out.lower() or len(out.strip()) == 0 or "[]" in out


class TestParser:
    def test_parser_has_embed_and_recall(self) -> None:
        parser = build_parser()
        # subparser 命令名
        # 解析 embed
        ns = parser.parse_args(["embed", "hello"])
        assert ns.command == "embed"
        assert ns.text == "hello"
        # 解析 recall
        ns = parser.parse_args(["recall", "hello", "--top-k", "5", "--kind", "case"])
        assert ns.command == "recall"
        assert ns.text == "hello"
        assert ns.top_k == 5
        assert ns.kind == "case"
