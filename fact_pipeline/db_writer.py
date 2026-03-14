from __future__ import annotations

from typing import Dict, Iterable, List


def _replace_collection(db, name: str, book_id, docs: Iterable[Dict]):
    docs = list(docs)
    db[name].delete_many({"book_id": book_id})
    if docs:
        db[name].insert_many(docs)


def write_pipeline_outputs(db, book_id, chunks: List[Dict], sentences: List[Dict], entities: List[Dict], facts: List[Dict], questions: List[Dict]):
    _replace_collection(db, "book_chunks", book_id, chunks)
    _replace_collection(db, "book_sentences", book_id, sentences)
    _replace_collection(db, "book_entities", book_id, entities)

    db["book_facts"].delete_many({"book_id": book_id})
    fact_ids = []
    if facts:
        result = db["book_facts"].insert_many(facts)
        fact_ids = result.inserted_ids

    prepared_questions = []
    for index, question in enumerate(questions):
        q = dict(question)
        q.pop("fact_key", None)
        if fact_ids:
            q["fact_id"] = fact_ids[index % len(fact_ids)]
        prepared_questions.append(q)

    _replace_collection(db, "book_questions", book_id, prepared_questions)
