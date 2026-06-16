"""苏格拉底追问引擎 — 主循环

参考 02-ARCHITECTURE 2.2 + D-004 + D-008
"""
from __future__ import annotations

from dataclasses import dataclass, field

from lu.config.loader import SocraticStopSignal
from lu.socratic.learning import should_stop, should_suggest_stop
from lu.socratic.output import RefinedProposition, build_refined_proposition
from lu.socratic.questions import QUESTION_TEMPLATES, Question, should_followup


@dataclass
class SocraticResult:
    proposition: str
    history: list[tuple[str, str]]  # (question_text, answer)
    refined_proposition: RefinedProposition
    early_stopped: bool = False
    rounds_completed: int = 0


@dataclass
class SocraticEngine:
    proposition: str
    signal: SocraticStopSignal
    ask_user: "callable"  # (question: str) -> str
    ask_yes_no: "callable"  # (prompt: str) -> bool
    llm_call: "callable"  # (prompt: str) -> str

    def _user_signaled_stop(self, answer: str) -> bool:
        return any(kw in answer for kw in self.signal.saturation_keywords)

    def _ask_with_followup(self, q: Question, history: list[tuple[str, str]]) -> str:
        answer = self.ask_user(f"[{q.id} {q.theme}] {q.prompt}")
        history.append((f"[{q.id} {q.theme}] {q.prompt}", answer))

        for rule in q.dynamic_triggers:
            if not should_followup(answer, rule):
                continue
            if not rule.skippable or not self.ask_yes_no(f"  ⚠ {rule.followup}"):
                continue
            followup_answer = self.ask_user(f"  ↳ {rule.followup}")
            history.append((f"  ↳ {rule.followup}", followup_answer))
            answer = followup_answer

        return answer

    def run(self) -> SocraticResult:
        history: list[tuple[str, str]] = []
        user_says_stop = False
        early_stopped = False
        rounds = 0

        for q in QUESTION_TEMPLATES:
            rounds += 1
            answer = self._ask_with_followup(q, history)

            if self._user_signaled_stop(answer):
                user_says_stop = True

            if should_suggest_stop(self.signal, rounds):
                if not self.ask_yes_no(f"  💡 已完成 {rounds} 轮，可收尾。继续吗？"):
                    early_stopped = True
                    break

            if should_stop(self.signal, rounds, user_says_stop):
                early_stopped = True
                break

        refined = build_refined_proposition(
            proposition=self.proposition,
            history=[(Question(id="", theme="", prompt=q), a) for q, a in history],
            llm_call=self.llm_call,
        )

        return SocraticResult(
            proposition=self.proposition,
            history=history,
            refined_proposition=refined,
            early_stopped=early_stopped or user_says_stop,
            rounds_completed=rounds,
        )
