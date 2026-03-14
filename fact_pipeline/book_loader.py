from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(slots=True)
class BookChunkRecord:
    chunk_id: str
    book_id: str
    chapter: int
    text: str
    position: int


class BookLoader:
    def __init__(self, db):
        self.db = db

    def load_chunks(self, book_id: str) -> List[BookChunkRecord]:
        chunks = list(self.db.book_chunks.find({'book_id': book_id}).sort('position', 1))
        if chunks:
            return [
                BookChunkRecord(
                    chunk_id=str(row['_id']),
                    book_id=row['book_id'],
                    chapter=int(row.get('chapter') or 0),
                    text=row.get('text', ''),
                    position=int(row.get('position') or 0),
                )
                for row in chunks
                if row.get('text')
            ]

        book = self.db.books.find_one({'_id': self._coerce_object_id(book_id)})
        if not book:
            return []

        derived = self._derive_chunks_from_book(book)
        if derived:
            self.db.book_chunks.insert_many(derived)

        return [
            BookChunkRecord(
                chunk_id=str(row['_id']),
                book_id=row['book_id'],
                chapter=row['chapter'],
                text=row['text'],
                position=row['position'],
            )
            for row in self.db.book_chunks.find({'book_id': book_id}).sort('position', 1)
        ]

    @staticmethod
    def _derive_chunks_from_book(book: dict, max_chars: int = 1200) -> List[dict]:
        from bson import ObjectId

        book_id = str(book['_id'])
        chapters = book.get('chapters') or []
        chunks: List[dict] = []
        position = 0
        for chapter in chapters:
            chapter_idx = int(chapter.get('index') or 0)
            html = (chapter.get('html') or '').replace('<p>', ' ').replace('</p>', '\n')
            text = ' '.join(html.split())
            if not text:
                continue
            for i in range(0, len(text), max_chars):
                piece = text[i:i + max_chars].strip()
                if not piece:
                    continue
                chunks.append(
                    {
                        '_id': ObjectId(),
                        'book_id': book_id,
                        'chapter': chapter_idx,
                        'text': piece,
                        'position': position,
                    }
                )
                position += 1
        return chunks

    @staticmethod
    def _coerce_object_id(value: str):
        from bson import ObjectId

        try:
            return ObjectId(value)
        except Exception:
            return value
