from __future__ import annotations

from typing import Dict, List


def build_chunks_from_book(book: Dict) -> List[Dict]:
    chunks: List[Dict] = []
    chapters = book.get("chapters") or []
    position = 0

    for chapter in chapters:
        chapter_index = int(chapter.get("index") or 0)
        html = str(chapter.get("html") or "")
        text = " ".join(html.replace("<", " <").split())
        if not text.strip():
            continue
        chunks.append(
            {
                "book_id": book["_id"],
                "chapter": chapter_index,
                "text": text,
                "position": position,
            }
        )
        position += 1

    return chunks
