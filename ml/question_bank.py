from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATASETS_DIR = ROOT / "datasets"


@dataclass(frozen=True)
class QuestionItem:
    question: str
    options: list[str]
    correct: str | None
    meta: dict[str, Any]


def _detect_format(df: pd.DataFrame) -> dict[str, str]:
    cols = set(df.columns)

    if {"Question", "Option_1", "Option_2", "Option_3", "Option_4"}.issubset(cols):
        return {
            "question": "Question",
            "o1": "Option_1",
            "o2": "Option_2",
            "o3": "Option_3",
            "o4": "Option_4",
            "correct": "Correct_Answer" if "Correct_Answer" in cols else "Correct_A" if "Correct_A" in cols else "",
        }

    if {"Question", "Option_A", "Option_B", "Option_C", "Option_D"}.issubset(cols):
        return {
            "question": "Question",
            "o1": "Option_A",
            "o2": "Option_B",
            "o3": "Option_C",
            "o4": "Option_D",
            "correct": "Correct_Option" if "Correct_Option" in cols else "",
        }

    raise ValueError("Unsupported question CSV format")


def load_dataset(name: str) -> pd.DataFrame:
    path = DATASETS_DIR / name
    if not path.exists():
        raise FileNotFoundError(str(path))
    return pd.read_csv(path)


def sample_questions(
    dataset_name: str,
    n: int,
    *,
    label_col: str | None = None,
    label_value: str | None = None,
    seed: int | None = None,
) -> list[QuestionItem]:
    """Randomly sample questions.

    - dataset_name: CSV filename in datasets/
    - label_col/label_value: optionally filter rows (e.g., Level='Beginner')
    """

    if seed is not None:
        random.seed(seed)

    df = load_dataset(dataset_name)
    fmt = _detect_format(df)

    if label_col and label_value is not None and label_col in df.columns:
        df = df[df[label_col].astype(str) == str(label_value)]

    if df.empty:
        return []

    take = min(n, len(df))
    rows = df.sample(n=take, random_state=seed) if seed is not None else df.sample(n=take)

    items: list[QuestionItem] = []
    for _, r in rows.iterrows():
        question = str(r[fmt["question"]])
        options = [str(r[fmt["o1"]]), str(r[fmt["o2"]]), str(r[fmt["o3"]]), str(r[fmt["o4"]])]

        correct = None
        correct_col = fmt["correct"]
        if correct_col:
            correct = str(r.get(correct_col, "")) or None

        meta = {k: (None if pd.isna(v) else v) for k, v in r.to_dict().items()}
        items.append(QuestionItem(question=question, options=options, correct=correct, meta=meta))

    return items
