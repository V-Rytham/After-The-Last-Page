from __future__ import annotations

from typing import Dict, Iterable, List, Set


def _extract_svo(doc):
    subject = None
    verb = None
    obj = None

    for token in doc:
        if token.pos_ == "VERB" and verb is None:
            verb = token.lemma_
        if token.dep_ in {"nsubj", "nsubjpass"} and subject is None:
            subject = token.text
        if token.dep_ in {"dobj", "pobj", "attr", "dative", "obj"} and obj is None:
            obj = token.text

    return subject, verb, obj


def extract_facts(nlp, sentences: Iterable[Dict], normalized_entities: Iterable[Dict]) -> List[Dict]:
    entities: Set[str] = {row["entity"].lower() for row in normalized_entities}
    facts: List[Dict] = []

    for row in sentences:
        text = row["sentence"].strip()
        if len(text.split()) < 5:
            continue

        if entities and not any(ent in text.lower() for ent in entities):
            continue

        doc = nlp(text)
        subject, verb, obj = _extract_svo(doc)
        if not subject or not verb or not obj:
            continue

        facts.append(
            {
                "book_id": row["book_id"],
                "chapter": row["chapter"],
                "subject": subject,
                "verb": verb,
                "object": obj,
                "sentence": text,
                "sentence_position": row["position"],
            }
        )

    return facts
