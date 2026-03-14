from __future__ import annotations

import random
from typing import Dict, Iterable, List


def _build_question(fact: Dict) -> str:
    verb = fact["verb"]
    obj = fact["object"]
    return f"Who {verb} {obj}?"


def generate_mcqs(facts: Iterable[Dict], entities: Iterable[Dict], min_questions: int = 100, max_questions: int = 300) -> List[Dict]:
    facts = list(facts)
    entities = [e["entity"] for e in entities if e.get("entity")]
    if len(entities) < 4:
        entities = entities + [f"Distractor {i}" for i in range(4 - len(entities))]

    random.shuffle(facts)
    questions: List[Dict] = []

    for fact in facts:
        correct = fact["subject"]
        pool = [e for e in entities if e.lower() != str(correct).lower()]
        if len(pool) < 3:
            continue
        distractors = random.sample(pool, 3)
        options = [correct, *distractors]
        random.shuffle(options)

        option_map = {"a": options[0], "b": options[1], "c": options[2], "d": options[3]}
        correct_option = next(key for key, value in option_map.items() if value == correct)

        questions.append(
            {
                "book_id": fact["book_id"],
                "question": _build_question(fact),
                "correct_answer": correct_option,
                "option_a": option_map["a"],
                "option_b": option_map["b"],
                "option_c": option_map["c"],
                "option_d": option_map["d"],
                "fact_key": (fact["chapter"], fact["sentence_position"], fact["subject"], fact["verb"], fact["object"]),
            }
        )

        if len(questions) >= max_questions:
            break

    if len(questions) < min_questions:
        return questions

    return questions
