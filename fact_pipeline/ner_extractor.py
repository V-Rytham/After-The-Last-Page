from __future__ import annotations

from collections import Counter
from typing import Dict, Iterable, List

TARGET_TYPES = {"PERSON", "ORG", "GPE", "LOC", "EVENT", "WORK_OF_ART", "DATE"}


def extract_entities(nlp, sentences: Iterable[Dict]) -> List[Dict]:
    counter: Counter = Counter()
    entity_types: Dict[str, str] = {}

    for row in sentences:
        doc = nlp(row["sentence"])
        for ent in doc.ents:
            if ent.label_ not in TARGET_TYPES:
                continue
            key = ent.text.strip()
            if len(key) < 2:
                continue
            normalized = " ".join(key.split())
            counter[normalized] += 1
            entity_types.setdefault(normalized, ent.label_)

    entities = []
    for entity, frequency in counter.items():
        entities.append(
            {
                "book_id": sentences[0]["book_id"] if sentences else None,
                "entity": entity,
                "entity_type": entity_types[entity],
                "frequency": frequency,
            }
        )

    return entities
