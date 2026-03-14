from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Dict, Iterable, List

from .sentence_splitter import SentenceRecord

TARGET_TYPES = {'PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE'}


@dataclass(slots=True)
class EntityRecord:
    entity_id: str
    book_id: str
    entity: str
    entity_type: str
    frequency: int


class NerExtractor:
    def __init__(self, nlp):
        self.nlp = nlp

    def extract(self, book_id: str, sentences: Iterable[SentenceRecord]) -> Dict[str, Counter]:
        counters: Dict[str, Counter] = {entity_type: Counter() for entity_type in TARGET_TYPES}
        sentence_rows = list(sentences)
        for doc in self.nlp.pipe((row.sentence for row in sentence_rows), batch_size=128):
            for ent in doc.ents:
                if ent.label_ not in TARGET_TYPES:
                    continue
                normalized = self._normalize(ent.text)
                if normalized:
                    counters[ent.label_][normalized] += 1
        return counters

    def to_rows(self, book_id: str, counters: Dict[str, Counter]) -> List[EntityRecord]:
        rows: List[EntityRecord] = []
        for entity_type, counter in counters.items():
            for idx, (entity, freq) in enumerate(counter.items()):
                rows.append(
                    EntityRecord(
                        entity_id=f'{book_id}:{entity_type}:{idx}',
                        book_id=book_id,
                        entity=entity,
                        entity_type=entity_type,
                        frequency=freq,
                    )
                )
        return rows

    @staticmethod
    def _normalize(value: str) -> str:
        cleaned = ' '.join(value.replace('\n', ' ').split()).strip(' .,;:!?"\'`')
        if not cleaned:
            return ''
        return cleaned.title() if len(cleaned) > 2 else cleaned.upper()
