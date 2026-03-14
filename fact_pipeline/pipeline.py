from __future__ import annotations

import argparse
import os
import time
from dataclasses import dataclass

import spacy
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

from book_loader import build_chunks_from_book
from db_writer import write_pipeline_outputs
from entity_normalizer import normalize_entities
from fact_extractor import extract_facts
from mcq_generator import generate_mcqs
from ner_extractor import extract_entities
from sentence_splitter import split_sentences


@dataclass
class PipelineStats:
    sentences: int
    entities: int
    facts: int
    questions: int
    duration_s: float


def run_pipeline(db, book_id: str) -> PipelineStats:
    model_name = os.getenv("FACT_PIPELINE_SPACY_MODEL", "en_core_web_sm")
    nlp = spacy.load(model_name)

    start = time.time()
    object_id = ObjectId(book_id)
    book = db["books"].find_one({"_id": object_id})
    if not book:
        raise ValueError(f"Book not found: {book_id}")

    chunks = build_chunks_from_book(book)
    sentences = split_sentences(nlp, chunks)
    entities = extract_entities(nlp, sentences)
    normalized_entities = normalize_entities(entities)
    facts = extract_facts(nlp, sentences, normalized_entities)
    questions = generate_mcqs(facts, normalized_entities)

    write_pipeline_outputs(
        db,
        object_id,
        chunks=chunks,
        sentences=sentences,
        entities=normalized_entities,
        facts=facts,
        questions=questions,
    )

    return PipelineStats(
        sentences=len(sentences),
        entities=len(normalized_entities),
        facts=len(facts),
        questions=len(questions),
        duration_s=time.time() - start,
    )


def main():
    parser = argparse.ArgumentParser(description="Offline fact extraction and MCQ generation pipeline")
    parser.add_argument("--book-id", required=True, help="MongoDB _id of book")
    parser.add_argument("--mongo-uri", default=None)
    parser.add_argument("--db-name", default=None)
    args = parser.parse_args()

    load_dotenv()

    mongo_uri = args.mongo_uri or os.getenv("MONGODB_URI", "mongodb://localhost:27017/after_the_last_page")
    db_name = args.db_name or os.getenv("FACT_PIPELINE_DB_NAME", "after_the_last_page")

    client = MongoClient(mongo_uri)
    db = client[db_name]

    stats = run_pipeline(db, args.book_id)
    print({
        "book_id": args.book_id,
        "sentences_extracted": stats.sentences,
        "entities_detected": stats.entities,
        "facts_generated": stats.facts,
        "questions_created": stats.questions,
        "duration_seconds": round(stats.duration_s, 3),
    })


if __name__ == "__main__":
    main()
