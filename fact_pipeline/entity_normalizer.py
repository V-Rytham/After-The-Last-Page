from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from difflib import SequenceMatcher
from typing import Iterable, List

from .ner_extractor import EntityRecord


class EntityNormalizer:
    def __init__(self, min_frequency: int = 2, fuzzy_threshold: float = 0.92):
        self.min_frequency = min_frequency
        self.fuzzy_threshold = fuzzy_threshold

    def normalize(self, rows: Iterable[EntityRecord]) -> List[EntityRecord]:
        grouped = defaultdict(list)
        for row in rows:
            grouped[row.entity_type].append(row)

        normalized: List[EntityRecord] = []
        for entity_type, entity_rows in grouped.items():
            canonical: List[EntityRecord] = []
            for row in sorted(entity_rows, key=lambda x: (-x.frequency, x.entity)):
                matched_index = self._find_match(canonical, row.entity)
                if matched_index is None:
                    canonical.append(row)
                else:
                    existing = canonical[matched_index]
                    canonical[matched_index] = replace(existing, frequency=existing.frequency + row.frequency)

            normalized.extend([row for row in canonical if row.frequency >= self.min_frequency])

        return normalized

    def _find_match(self, candidates: List[EntityRecord], entity: str):
        entity_l = entity.lower()
        for idx, candidate in enumerate(candidates):
            cand_l = candidate.entity.lower()
            if entity_l == cand_l or entity_l in cand_l or cand_l in entity_l:
                return idx
            ratio = SequenceMatcher(None, entity_l, cand_l).ratio()
            if ratio >= self.fuzzy_threshold:
                return idx
        return None
