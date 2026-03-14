from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Set

from .sentence_splitter import SentenceRecord


@dataclass(slots=True)
class FactRecord:
    fact_id: str
    book_id: str
    chapter: int
    subject: str
    verb: str
    object: str
    sentence: str
    sentence_position: int


class FactExtractor:
    def __init__(self, nlp):
        self.nlp = nlp

    def extract(self, book_id: str, sentences: Iterable[SentenceRecord], known_entities: Set[str]) -> List[FactRecord]:
        facts: List[FactRecord] = []
        sentence_rows = list(sentences)
        for row, doc in zip(sentence_rows, self.nlp.pipe((s.sentence for s in sentence_rows), batch_size=128)):
            if len(row.sentence.split()) < 5:
                continue

            verbs = [tok for tok in doc if tok.pos_ in {'VERB', 'AUX'}]
            if not verbs:
                continue

            for verb in verbs:
                subjects = [child for child in verb.children if child.dep_ in {'nsubj', 'nsubjpass'}]
                objects = [child for child in verb.children if child.dep_ in {'dobj', 'attr', 'pobj', 'dative', 'oprd'}]
                if not subjects or not objects:
                    continue

                for subj in subjects:
                    subject_text = self._span_text(subj)
                    for obj in objects:
                        object_text = self._span_text(obj)
                        if not self._is_meaningful_fact(subject_text, object_text, known_entities):
                            continue

                        facts.append(
                            FactRecord(
                                fact_id=f'{book_id}:{row.position}:{len(facts)}',
                                book_id=book_id,
                                chapter=row.chapter,
                                subject=subject_text,
                                verb=verb.lemma_.lower(),
                                object=object_text,
                                sentence=row.sentence,
                                sentence_position=row.position,
                            )
                        )
        return facts

    @staticmethod
    def _span_text(token):
        subtree = list(token.subtree)
        text = ' '.join(tok.text for tok in subtree)
        return ' '.join(text.split()).strip(' .,;:!?')

    @staticmethod
    def _is_meaningful_fact(subject: str, object_: str, known_entities: Set[str]) -> bool:
        if not subject or not object_:
            return False
        subject_l = subject.lower()
        object_l = object_.lower()
        if subject_l == object_l:
            return False
        if known_entities:
            entity_hits = sum(
                1
                for item in (subject_l, object_l)
                if any(ent in item or item in ent for ent in known_entities)
            )
            return entity_hits >= 1
        return True
