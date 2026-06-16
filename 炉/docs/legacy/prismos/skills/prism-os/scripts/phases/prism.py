"""Phase 2: 棱镜引擎 + 决策点 1（标题选择）"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
import sys


# v1.1: deep 模式 based_on key → 中文标签 + 描述
# 数据从 title_deep.VALID_BASED_ON 来（8 个标准角度）
_DEEP_BASED_ON_LABELS = {
    "core_claim_challenge":   ("核心主张挑战", "挑战核心论点，看是否经得起推敲"),
    "hidden_assumption_reveal": ("隐含假设揭示", "挖掘读者没意识到的预设"),
    "contrarian_inversion":    ("反主流逆袭", "颠覆大众认知，提出新视角"),
    "audience_specific":       ("特定人群", "瞄准具体身份/职业/年龄的痛点"),
    "scenario_specific":       ("特定场景", "聚焦具体场景中的现象"),
    "pain_anchor":             ("痛点锚定", "直接戳读者最痛的那个点"),
    "value_promise":           ("价值承诺", "承诺具体可感知的收益"),
    "unanswered_question":     ("未答之问", "抛出读者想问但没人答的问题"),
}


class PrismPhase(Phase):
    """Phase 2: 生成候选标题 + 用户选择"""

    @property
    def name(self) -> str:
        return "prism"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return state.intent is not None and state.intent.get("trigger")

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from prism_engine import prism_engine

        # 如果有用户回复，解析选择
        if state.user_reply and state.candidates:
            return self._handle_user_reply(state, config)

        # M1: 加载 persona 提取 identity_role / audience（若 state 中没传）
        identity_role = getattr(state, "identity_role", "") or ""
        audience = getattr(state, "audience", "") or ""
        if not identity_role or not audience:
            try:
                sys.path.insert(0, str(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))
                from persona import load as _load_persona, format_for_prism
                _p = _load_persona(getattr(config, "persona_name", "default"))
                _fmt = format_for_prism(_p)
                identity_role = identity_role or _fmt["identity_role"]
                audience = audience or _fmt["audience"]
                # 缓存到 state 供后续 phase 复用
                state.identity_role = identity_role
                state.audience = audience
            except Exception as e:
                print(f"[Warning] PrismPhase 加载 persona 失败: {e}", file=sys.stderr)

        # v1.1: 注入方向选择（如果用户在 DirectionSelectPhase 选了方向）
        prism_thesis = state.thesis
        if getattr(state, "direction_selected", ""):
            prism_thesis = f"{state.thesis}（切入角度：{state.direction_selected}）"

        prism_result = prism_engine(prism_thesis, identity_role=identity_role, audience=audience)
        candidates = prism_result.get("candidates", [])

        if not candidates:
            return PhaseResult(status="rejected", data=prism_result, message="无候选标题")

        # HKR 评分
        from socratic_gateway import calculate_hkr
        for c in candidates:
            try:
                c["hkr"] = calculate_hkr(c["title"])
            except Exception:
                c["hkr"] = {"h": 0, "k": 0, "r": 0, "hkr_avg": 0}

        # 标记低分
        for c in candidates:
            hkr_avg = c.get("hkr", {}).get("hkr_avg", 0)
            if hkr_avg < 0.5:
                c["low_hkr"] = True

        # M4: 按 A1 张力 × 0.6 + A3 风格 × 0.4 排序
        try:
            from title_scoring import sort_by_score
            candidates = sort_by_score(candidates)
        except Exception:
            pass  # 排序失败不阻断

        # 决策点 1：交互式选择标题
        if config.interactive:
            prompt = self._format_title_prompt(candidates)
            return PhaseResult(
                status="need_input",
                data={"candidates": candidates, "candidates_count": len(candidates)},
                prompt=prompt,
                input_type="title_select",
            )

        # 非交互模式：自动选第一个
        return PhaseResult(status="success", data={
            "candidates": candidates,
            "selected_candidate": candidates[0],
            "user_selected_candidate": False,
        })

    def _handle_user_reply(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        """处理用户对标题选择的回复"""
        reply = state.user_reply.strip()
        candidates = state.candidates

        # M2: 如果在深度模式，优先用 deep 解析
        if state.deep_titles:
            return self._handle_deep_reply(state, config, reply)

        if reply.lower() == "q":
            return PhaseResult(status="success", data={
                "candidates": candidates,
                "selected_candidate": candidates[0],
                "user_selected_candidate": False,
            })

        # M2: 进入深度模式
        if reply.lower() == "d":
            return self._enter_deep_mode(state, config)

        # M5: 补生成缺失维度
        if reply.lower() == "r":
            return self._regenerate_missing(state, config)

        if reply == "":
            return PhaseResult(status="success", data={
                "candidates": candidates,
                "selected_candidate": candidates[0],
                "user_selected_candidate": False,
            })

        try:
            idx = int(reply) - 1
            if 0 <= idx < len(candidates):
                return PhaseResult(status="success", data={
                    "candidates": candidates,
                    "selected_candidate": candidates[idx],
                    "user_selected_candidate": True,
                })
        except ValueError:
            pass

        # v1.4: 无效输入 → 重新显示提示（不再静默选第一个）
        return PhaseResult(
            status="need_input",
            data={"candidates": candidates, "candidates_count": len(candidates)},
            prompt=self._format_title_prompt(candidates),
            input_type="title_select",
        )

    def _handle_deep_reply(self, state: PipelineState, config: PipelineConfig, reply: str) -> PhaseResult:
        """处理用户在深度模式下的命令"""
        from title_deep import handle_deep_command, generate_titles_with_retry

        deep_state = {
            "depth": state.depth_analysis,
            "titles": state.deep_titles,
        }
        result = handle_deep_command(reply, deep_state)
        action = result.get("action")

        if action == "select":
            idx = result["index"]
            selected = state.deep_titles[idx]
            # 用 deep 选择的标题作为最终 selected_candidate
            # 构造一个 candidates 兼容结构（让 CCOS 能识别）
            deep_selected = {
                "title": selected["title"],
                "based_on": selected["based_on"],
                "why": selected.get("why", ""),
                "rationale": selected.get("why", ""),
                "dimension": "deep",  # 标记为深度模式
                "archetype": selected.get("based_on", ""),
                "char_count": len(selected["title"]),
                "from_deep_mode": True,
            }
            # 合并到 candidates 列表（让 selected_candidate 是它的索引）
            new_candidates = list(state.candidates) + [deep_selected]
            return PhaseResult(status="success", data={
                "candidates": new_candidates,
                "selected_candidate": deep_selected,
                "user_selected_candidate": True,
                "from_deep_mode": True,
            })

        if action == "regenerate":
            # m: 重新生成 5 个
            from title_deep import deep_analyze
            depth = deep_analyze(state.thesis)
            if depth is None:
                # 失败，保持当前
                prompt = self._format_deep_prompt(state.thesis, type("D", (), state.depth_analysis)(), state.deep_titles)
                return PhaseResult(status="need_input", data={}, prompt=prompt, input_type="deep_title_select")
            avoid_keywords = []
            try:
                sys.path.insert(0, str(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))
                from persona import load as _load_persona
                _p = _load_persona(getattr(config, "persona_name", "default"))
                avoid_keywords = _p.get("avoid_keywords", [])
            except Exception:
                pass
            new_titles = generate_titles_with_retry(state.thesis, depth, avoid_keywords, count=5)
            if new_titles:
                state.deep_titles = new_titles
                state.depth_analysis = depth.to_dict()
            prompt = self._format_deep_prompt(state.thesis, depth, state.deep_titles)
            return PhaseResult(status="need_input", data={
                "deep_titles": state.deep_titles,
                "depth_analysis": state.depth_analysis,
            }, prompt=prompt, input_type="deep_title_select")

        if action == "back_to_broad":
            # b: 回到广度候选
            state.deep_titles = []
            state.depth_analysis = None
            # 重新展示广度
            prompt = self._format_title_prompt(state.candidates)
            return PhaseResult(status="need_input", data={
                "candidates": state.candidates,
            }, prompt=prompt, input_type="title_select")

        if action == "show_why":
            idx = result["index"]
            if 0 <= idx < len(state.deep_titles):
                why = state.deep_titles[idx].get("why", "(无 why)")
                # 重新显示完整 deep prompt + 追加 why
                from title_deep import deep_analyze
                depth = deep_analyze(state.thesis) if state.depth_analysis is None else type("D", (), state.depth_analysis)()
                prompt = self._format_deep_prompt(state.thesis, depth, state.deep_titles)
                prompt += f"\n\n[why #{idx+1}]: {why}"
                return PhaseResult(status="need_input", data={
                    "deep_titles": state.deep_titles,
                }, prompt=prompt, input_type="deep_title_select")

        if action == "exit":
            return PhaseResult(status="rejected", data={
                "candidates": state.candidates,
            }, message="用户退出深度模式")

        # error: 显示错误 + 重新展示
        from title_deep import deep_analyze
        depth = deep_analyze(state.thesis) if state.depth_analysis is None else type("D", (), state.depth_analysis)()
        prompt = self._format_deep_prompt(state.thesis, depth, state.deep_titles)
        prompt += f"\n\n[错误] {result.get('message', '未知命令')}"
        return PhaseResult(status="need_input", data={
            "deep_titles": state.deep_titles,
        }, prompt=prompt, input_type="deep_title_select")

    def _enter_deep_mode(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        """M2: 深度模式入口 — 跑 9 维拆解 + 生成 5 标题，显示 deep prompt"""
        from title_deep import deep_analyze, generate_titles_with_retry

        # 加载 persona 的 avoid_keywords（如果可用）
        avoid_keywords = []
        try:
            sys.path.insert(0, str(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))
            from persona import load as _load_persona
            _p = _load_persona(getattr(config, "persona_name", "default"))
            avoid_keywords = _p.get("avoid_keywords", [])
        except Exception:
            pass

        # 1) 9 维拆解
        depth = deep_analyze(state.thesis)
        if depth is None:
            return PhaseResult(status="rejected", data={
                "candidates": state.candidates,
            }, message="深度拆解失败，请重试或选广度候选")

        # 2) 生成 5 标题（含过滤和重试）
        deep_titles = generate_titles_with_retry(state.thesis, depth, avoid_keywords, count=5)

        if not deep_titles:
            return PhaseResult(status="rejected", data={
                "candidates": state.candidates,
            }, message="深度标题生成失败，请选广度候选")

        # 3) 展示 deep prompt，等用户回复
        prompt = self._format_deep_prompt(state.thesis, depth, deep_titles)
        # 缓存到 state 供 _handle_user_reply 复用
        state.deep_titles = deep_titles
        state.depth_analysis = depth.to_dict()
        return PhaseResult(
            status="need_input",
            data={
                "candidates": state.candidates,
                "deep_titles": deep_titles,
                "depth_analysis": depth.to_dict(),
                "deep_mode": True,
            },
            prompt=prompt,
            input_type="deep_title_select",
        )

    def _format_deep_prompt(self, thesis: str, depth, titles: list) -> str:
        """格式化深度模式标题选择 prompt"""
        from title_deep import handle_deep_command

        lines = ["\n━━━ 深度模式 ━━━"]
        lines.append(f"\n命题: {thesis}")
        lines.append("\n[9 维深度拆解]")
        lines.append(f"  核心主张: {depth.core_claim}")
        if depth.hidden_assumptions:
            lines.append(f"  隐含假设: {', '.join(depth.hidden_assumptions[:3])}")
        lines.append(f"  主流叙事: {depth.mainstream_narrative}")
        if depth.contrarian_takes:
            lines.append(f"  反主流: {', '.join(depth.contrarian_takes[:3])}")
        lines.append(f"  隐藏对象: {depth.hidden_audience}")
        if depth.scenarios:
            lines.append(f"  场景: {depth.scenarios[0]}")
        if depth.pain_points:
            lines.append(f"  痛点: {', '.join(depth.pain_points[:3])}")
        if depth.value_anchors:
            lines.append(f"  价值锚点: {', '.join(depth.value_anchors)}")
        if depth.unanswered_questions:
            lines.append(f"  未答问题: {depth.unanswered_questions[0]}")
        lines.append(f"\n[5 个深度标题]")
        for i, t in enumerate(titles, 1):
            mark = t.get("based_on", "?")
            star = " ⭐" if i == 1 else ""
            label, desc = _DEEP_BASED_ON_LABELS.get(mark, (mark, ""))
            lines.append(f"  {i}. {t['title']}  [{label}]{star}")
            if desc:
                lines.append(f"     💡 {desc}")
        lines.append("\n请选择:")
        lines.append("  1-5  选择该编号标题（进入 CCOS）")
        lines.append("  m    再来 5 个（基于同一拆解）")
        lines.append("  w N  查看 N 号的完整 why 分析")
        lines.append("  b    回退到广度候选")
        lines.append("  q    退出")
        return "\n".join(lines)

    def _regenerate_missing(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        """M5: 补生成缺失维度的标题"""
        from coverage import analyze_coverage, regenerate_missing_dimensions

        candidates = state.candidates
        report = analyze_coverage(candidates, mode="broad")

        if not report.missing:
            # 没有缺失维度，重新显示 prompt
            prompt = self._format_title_prompt(candidates)
            return PhaseResult(
                status="need_input",
                data={"candidates": candidates, "candidates_count": len(candidates)},
                prompt=prompt,
                input_type="title_select",
            )

        # 补生成缺失维度
        identity_role = getattr(state, "identity_role", "")
        audience = getattr(state, "audience", "")
        new_titles = regenerate_missing_dimensions(
            report.missing, state.thesis,
            identity_role=identity_role, audience=audience,
        )

        if new_titles:
            # 合并到候选列表
            candidates = list(candidates) + new_titles
            # 重新排序
            try:
                from title_scoring import sort_by_score
                candidates = sort_by_score(candidates)
            except Exception:
                pass
            state.candidates = candidates

        # 重新显示 prompt
        prompt = self._format_title_prompt(candidates)
        return PhaseResult(
            status="need_input",
            data={"candidates": candidates, "candidates_count": len(candidates)},
            prompt=prompt,
            input_type="title_select",
        )

    def _format_title_prompt(self, candidates: list) -> str:
        """格式化标题选择提示（按规范全展开）"""
        lines = ["\n━━━ 候选标题列表 ━━━"]

        # M5: 维度覆盖报告
        try:
            from coverage import analyze_coverage
            report = analyze_coverage(candidates, mode="broad")
            dim_parts = []
            for d in ["reversal", "benefit_anchor", "micro_scene", "contrarian"]:
                cnt = report.counts.get(d, 0)
                mark = "✓" if cnt > 0 else "✗"
                dim_parts.append(f"{mark} {d}({cnt})")
            lines.append(f"  [维度覆盖] {' '.join(dim_parts)}")
            if report.missing:
                lines.append(f"  缺失: {', '.join(report.missing)}")
        except Exception:
            pass

        for i, c in enumerate(candidates, 1):
            hkr = c.get("hkr", {})
            hkr_avg = hkr.get("hkr_avg", 0)
            mark = "⚠️" if c.get("low_hkr") else "✓"
            dim = c.get("dimension", "?")
            arch = c.get("archetype", "?")
            rationale = c.get("rationale", "")
            char_count = c.get("char_count", 0)
            max_sim = c.get("max_similarity", 0)
            tension = c.get("tension_score", "?")

            # v1.1: 第一个 = sort_by_score 最高 = ⭐ 推荐
            star = " ⭐ 推荐" if i == 1 else ""
            lines.append(f"  {i}. {mark} {c.get('title', '')}{star}")
            lines.append(f"     HKR={hkr_avg:.2f} | 张力={tension} | {dim} | {arch}")
            lines.append(f"     字数: {char_count} | 最高相似度: {max_sim:.2f}")
            if rationale:
                # v1.1: 解除 50 字截断，显示完整理由（可能换行）
                lines.append(f"     理由: {rationale}")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        n = len(candidates)
        lines.append(f"  1-{n}    选择该编号标题 → 进入大纲生成（CCOS）")
        lines.append("  d        深度模式 → 对命题做 9 维深度拆解，生成 5 个高张力标题")
        lines.append("  r        补生成缺失维度 → 针对上面缺失的维度生成新标题")
        lines.append("  q        退出（不保存，可重新跑 run 再来）")
        lines.append("  其他输入 → 重新显示本提示")
        return "\n".join(lines)

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        if result.status == "need_input":
            print(result.prompt, file=sys.stderr)
        else:
            candidates = result.data.get("candidates", [])
            selected = result.data.get("selected_candidate", {})
            user_sel = result.data.get("user_selected_candidate", False)
            mark = "（用户选）" if user_sel else "（默认）"
            # 4 维计数
            dim_counts = {}
            for c in candidates:
                dim = c.get("dimension", "?")
                dim_counts[dim] = dim_counts.get(dim, 0) + 1
            dim_str = " / ".join([f"{d} {n}" for d, n in dim_counts.items()])
            # HKR 分布
            hkr_5 = sum(1 for c in candidates if c.get("hkr", {}).get("hkr_avg", 0) >= 0.5)
            hkr_3 = sum(1 for c in candidates if 0.3 <= c.get("hkr", {}).get("hkr_avg", 0) < 0.5)
            hkr_low = sum(1 for c in candidates if c.get("hkr", {}).get("hkr_avg", 0) < 0.3)
            print(f"[Phase 2] 棱镜: {len(candidates)} 个候选（{dim_str}）", file=sys.stderr)
            print(f"        HKR 分布: ≥0.5={hkr_5} / 0.3-0.5={hkr_3} / <0.3={hkr_low}", file=sys.stderr)
            print(f"        选中{mark}: {selected.get('title', '')[:40]}", file=sys.stderr)
