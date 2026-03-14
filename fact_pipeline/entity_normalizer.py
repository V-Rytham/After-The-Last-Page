from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List

from rapidfuzz import fuzz


def normalize_entities(entities: Iterable[Dict], min_frequency: int = 2) -> List[Dict]:
    grouped = defaultdict(list)
    for row in entities:
        grouped[row["entity_type"]].append(dict(row))

    normalized: List[Dict] = []

    for entity_type, rows in grouped.items():
        rows = sorted(rows, key=lambda x: x["frequency"], reverse=True)
        canonical = []

        for row in rows:
            merged = False
            for item in canonical:
                score = fuzz.token_sort_ratio(row["entity"].lower(), item["entity"].lower())
                if score >= 92:
                    item["frequency"] += row["frequency"]
                    merged = True
                    break
            if not merged:
                canonical.append(row)

        for item in canonical:
            if item["frequency"] >= min_frequency:
                normalized.append(item)

    return normalized
