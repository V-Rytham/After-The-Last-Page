from __future__ import annotations

import argparse

from .pipeline import FactPipeline


def main():
    parser = argparse.ArgumentParser(description='Run a sample book through the offline QA pipeline')
    parser.add_argument('--mongo-uri', required=True)
    parser.add_argument('--book-id', required=True)
    parser.add_argument('--db-name', default='after-the-last-page')
    args = parser.parse_args()

    pipeline = FactPipeline(args.mongo_uri, args.db_name)
    stats = pipeline.run_for_book(args.book_id)

    print('Pipeline summary')
    print(f'number of sentences extracted: {stats.sentences}')
    print(f'number of entities detected: {stats.entities}')
    print(f'number of facts generated: {stats.facts}')
    print(f'number of questions created: {stats.questions}')
    print(f'elapsed seconds: {stats.elapsed_seconds:.2f}')


if __name__ == '__main__':
    main()
