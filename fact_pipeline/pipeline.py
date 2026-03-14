from __future__ import annotations

import argparse
import time
from dataclasses import dataclass

import spacy
from pymongo import MongoClient

from .book_loader import BookLoader
from .db_writer import DbWriter
from .entity_normalizer import EntityNormalizer
from .fact_extractor import FactExtractor
from .mcq_generator import McqGenerator
from .ner_extractor import NerExtractor
from .sentence_splitter import SentenceSplitter


@dataclass(slots=True)
class PipelineStats:
    sentences: int
    entities: int
    facts: int
    questions: int
    elapsed_seconds: float


class FactPipeline:
    def __init__(self, mongo_uri: str, db_name: str = 'after-the-last-page'):
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.writer = DbWriter(self.db)

        self.spacy_pipeline = spacy.load('en_core_web_sm', disable=['textcat'])
        self.spacy_pipeline.add_pipe('sentencizer', before='parser') if 'sentencizer' not in self.spacy_pipeline.pipe_names else None

        self.loader = BookLoader(self.db)
        self.sentence_splitter = SentenceSplitter(self.spacy_pipeline)
        self.ner_extractor = NerExtractor(self.spacy_pipeline)
        self.entity_normalizer = EntityNormalizer()
        self.fact_extractor = FactExtractor(self.spacy_pipeline)
        self.mcq_generator = McqGenerator(max_questions=300)

    def run_for_book(self, book_id: str) -> PipelineStats:
        started = time.perf_counter()
        self.writer.ensure_indexes()

        chunks = self.loader.load_chunks(book_id)
        sentences = self.sentence_splitter.extract(chunks)

        entity_counts = self.ner_extractor.extract(book_id, sentences)
        entity_rows = self.entity_normalizer.normalize(self.ner_extractor.to_rows(book_id, entity_counts))

        entity_pool = [row.entity for row in entity_rows]
        facts = self.fact_extractor.extract(book_id, sentences, {entity.lower() for entity in entity_pool})
        questions = self.mcq_generator.generate(book_id, facts, entity_pool)

        self.writer.replace_book_records(
            book_id=book_id,
            sentences=sentences,
            entities=entity_rows,
            facts=facts,
            questions=questions,
        )

        elapsed = time.perf_counter() - started
        return PipelineStats(
            sentences=len(sentences),
            entities=len(entity_rows),
            facts=len(facts),
            questions=len(questions),
            elapsed_seconds=elapsed,
        )


def main():
    parser = argparse.ArgumentParser(description='Offline fact extraction and MCQ generation pipeline')
    parser.add_argument('--mongo-uri', required=True)
    parser.add_argument('--book-id', required=True)
    parser.add_argument('--db-name', default='after-the-last-page')
    args = parser.parse_args()

    pipeline = FactPipeline(args.mongo_uri, args.db_name)
    stats = pipeline.run_for_book(args.book_id)

    print(f"sentences={stats.sentences}")
    print(f"entities={stats.entities}")
    print(f"facts={stats.facts}")
    print(f"questions={stats.questions}")
    print(f"elapsed_seconds={stats.elapsed_seconds:.3f}")


if __name__ == '__main__':
    main()
