from __future__ import annotations

from typing import Dict, Iterable, List


def split_sentences(nlp, chunks: Iterable[Dict]) -> List[Dict]:
    sentences: List[Dict] = []

    for chunk in chunks:
        doc = nlp(chunk["text"])
        local_position = 0
        for sent in doc.sents:
            text = sent.text.strip()
            if not text:
                continue
            sentences.append(
                {
                    "book_id": chunk["book_id"],
                    "chapter": chunk["chapter"],
                    "sentence": text,
                    "position": chunk["position"] * 1000 + local_position,
                }
            )
            local_position += 1

    return sentences
