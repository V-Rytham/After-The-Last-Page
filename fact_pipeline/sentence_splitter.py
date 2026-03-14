from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from .book_loader import BookChunkRecord


@dataclass(slots=True)
class SentenceRecord:
    sentence_id: str
    book_id: str
    chapter: int
    sentence: str
    position: int


class SentenceSplitter:
    def __init__(self, nlp):
        self.nlp = nlp

    def extract(self, chunks: Iterable[BookChunkRecord]) -> List[SentenceRecord]:
        rows: List[SentenceRecord] = []
        sent_position = 0

        chunk_list = list(chunks)
        texts = [chunk.text for chunk in chunk_list]
        for chunk, doc in zip(chunk_list, self.nlp.pipe(texts, batch_size=128)):
            for sent in doc.sents:
                normalized = ' '.join(sent.text.split())
                if len(normalized) < 2:
                    continue
                rows.append(
                    SentenceRecord(
                        sentence_id=f"{chunk.book_id}:{sent_position}",
                        book_id=chunk.book_id,
                        chapter=chunk.chapter,
                        sentence=normalized,
                        position=sent_position,
                    )
                )
                sent_position += 1
        return rows
