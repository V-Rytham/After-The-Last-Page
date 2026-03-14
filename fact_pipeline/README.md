# Offline Book Fact + MCQ Pipeline

This folder implements the full offline processing worker for reader-authenticity verification.

## Components

- `book_loader.py`: loads `book_chunks` and backfills chunks from `books.chapters` when needed.
- `sentence_splitter.py`: spaCy sentence segmentation with chapter/position mapping.
- `ner_extractor.py`: named-entity extraction for `PERSON`, `ORG`, `GPE`, `LOC`, `EVENT`, `WORK_OF_ART`, `DATE`.
- `entity_normalizer.py`: duplicate merge + fuzzy normalization + low-frequency filtering.
- `fact_extractor.py`: dependency-based SVO extraction with quality filters.
- `mcq_generator.py`: converts facts to 4-option MCQs and creates distractors from in-book entities.
- `db_writer.py`: writes `book_sentences`, `book_entities`, `book_facts`, `book_questions` and builds indexes.
- `pipeline.py`: orchestration entrypoint for a full offline processing run.
- `run_sample_pipeline.py`: testing script that prints sentence/entity/fact/question counts.

## Database collections

- `books`
- `book_chunks`
- `book_sentences`
- `book_entities`
- `book_facts`
- `book_questions`

### Required indexes

Created by `DbWriter.ensure_indexes()`:

- `book_chunks`: `(book_id, chapter, position)`
- `book_sentences`: `(book_id, chapter, position)`
- `book_entities`: `(book_id, entity)` unique
- `book_facts`: `(book_id, chapter, sentence_position)`
- `book_questions`: `(book_id, fact_id)` unique and `(book_id)`

## Runtime API contract

- `GET /api/books/:id/questions?limit=5`: fetches random questions with randomized option order.
- `POST /api/books/:id/questions/verify`: validates selected options and returns pass/fail.

## Running

```bash
pip install -r fact_pipeline/requirements.txt
python -m spacy download en_core_web_sm
python -m fact_pipeline.pipeline --mongo-uri "$MONGODB_URI" --book-id "<book_id>" --db-name "after-the-last-page"
```

Sample test run:

```bash
python -m fact_pipeline.run_sample_pipeline --mongo-uri "$MONGODB_URI" --book-id "<book_id>"
```

## Performance guidance

- Uses `nlp.pipe(..., batch_size=128)` for throughput.
- Precomputes and stores all facts/questions offline.
- Runtime APIs only read indexed collections, no NLP work in request path.
