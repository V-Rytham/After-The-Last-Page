from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable, List, Sequence

from .fact_extractor import FactRecord


@dataclass(slots=True)
class QuestionRecord:
    question_id: str
    book_id: str
    question: str
    correct_answer: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    fact_id: str


class McqGenerator:
    def __init__(self, rng_seed: int | None = None, max_questions: int = 300):
        self.random = random.Random(rng_seed)
        self.max_questions = max_questions

    def generate(self, book_id: str, facts: Iterable[FactRecord], entity_pool: Sequence[str]) -> List[QuestionRecord]:
        candidates: List[QuestionRecord] = []
        unique_questions = set()

        entity_pool_clean = [ent for ent in dict.fromkeys(entity_pool) if ent]
        for fact in facts:
            prompt, answer = self._fact_to_question(fact)
            if not prompt or not answer:
                continue

            distractors = [ent for ent in entity_pool_clean if ent != answer and ent not in {fact.subject, fact.object}]
            if len(distractors) < 3:
                continue

            wrong = self.random.sample(distractors, 3)
            options = [answer, *wrong]
            self.random.shuffle(options)

            if prompt in unique_questions:
                continue
            unique_questions.add(prompt)

            candidates.append(
                QuestionRecord(
                    question_id=f'{book_id}:{len(candidates)}',
                    book_id=book_id,
                    question=prompt,
                    correct_answer=answer,
                    option_a=options[0],
                    option_b=options[1],
                    option_c=options[2],
                    option_d=options[3],
                    fact_id=fact.fact_id,
                )
            )

        if len(candidates) > self.max_questions:
            return self.random.sample(candidates, self.max_questions)

        return candidates

    def _fact_to_question(self, fact: FactRecord):
        if fact.subject and fact.object:
            if any(ch.isalpha() for ch in fact.subject):
                return f'Who {fact.verb} {fact.object}?', fact.subject
            return f'What {fact.verb} {fact.object}?', fact.subject
        return None, None
