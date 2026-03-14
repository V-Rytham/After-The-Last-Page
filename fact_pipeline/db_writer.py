from __future__ import annotations

from typing import Iterable, List

from pymongo import UpdateOne


class DbWriter:
    def __init__(self, db):
        self.db = db

    def replace_book_records(
        self,
        *,
        book_id: str,
        sentences: Iterable,
        entities: Iterable,
        facts: Iterable,
        questions: Iterable,
    ) -> None:
        self.db.book_sentences.delete_many({'book_id': book_id})
        self.db.book_entities.delete_many({'book_id': book_id})
        self.db.book_facts.delete_many({'book_id': book_id})
        self.db.book_questions.delete_many({'book_id': book_id})

        self._bulk_insert('book_sentences', [
            {
                'sentence_id': row.sentence_id,
                'book_id': row.book_id,
                'chapter': row.chapter,
                'sentence': row.sentence,
                'position': row.position,
            }
            for row in sentences
        ])
        self._bulk_insert('book_entities', [
            {
                'entity_id': row.entity_id,
                'book_id': row.book_id,
                'entity': row.entity,
                'entity_type': row.entity_type,
                'frequency': row.frequency,
            }
            for row in entities
        ])
        self._bulk_insert('book_facts', [
            {
                'fact_id': row.fact_id,
                'book_id': row.book_id,
                'chapter': row.chapter,
                'subject': row.subject,
                'verb': row.verb,
                'object': row.object,
                'sentence': row.sentence,
                'sentence_position': row.sentence_position,
            }
            for row in facts
        ])
        self._bulk_insert('book_questions', [
            {
                'question_id': row.question_id,
                'book_id': row.book_id,
                'question': row.question,
                'correct_answer': row.correct_answer,
                'option_a': row.option_a,
                'option_b': row.option_b,
                'option_c': row.option_c,
                'option_d': row.option_d,
                'fact_id': row.fact_id,
            }
            for row in questions
        ])

    def ensure_indexes(self) -> None:
        self.db.book_chunks.create_index([('book_id', 1), ('chapter', 1), ('position', 1)])
        self.db.book_sentences.create_index([('book_id', 1), ('chapter', 1), ('position', 1)])
        self.db.book_entities.create_index([('book_id', 1), ('entity', 1)], unique=True)
        self.db.book_entities.create_index([('book_id', 1), ('chapter', 1)], sparse=True)
        self.db.book_facts.create_index([('book_id', 1), ('chapter', 1), ('sentence_position', 1)])
        self.db.book_questions.create_index([('book_id', 1), ('fact_id', 1)], unique=True)
        self.db.book_questions.create_index([('book_id', 1)])

    def _bulk_insert(self, collection_name: str, rows: List[dict]):
        if not rows:
            return
        self.db[collection_name].insert_many(rows, ordered=False)
