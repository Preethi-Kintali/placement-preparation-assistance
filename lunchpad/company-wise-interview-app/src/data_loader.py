from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd


@dataclass
class DatasetPaths:
    root_dir: Path


def infer_company_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    parts = stem.split("_")
    if len(parts) < 2:
        return stem.lower().strip()
    return "_".join(parts[:-1]).lower().strip()


def discover_dataset_root(start_dir: Optional[Path] = None) -> Path:
    base = start_dir or Path(__file__).resolve().parents[2]
    candidates = [
        base / "LeetCode-Company-Wise-Questions-main" / "LeetCode-Company-Wise-Questions-main",
        base / "LeetCode-Company-Wise-Questions-main",
        base.parent / "LeetCode-Company-Wise-Questions-main" / "LeetCode-Company-Wise-Questions-main",
        base.parent / "LeetCode-Company-Wise-Questions-main",
        base,
        base.parent,
    ]
    for candidate in candidates:
        if candidate.exists() and any(candidate.glob("*.csv")):
            return candidate

    for candidate in base.rglob("*"):
        if candidate.is_dir() and any(candidate.glob("*.csv")):
            return candidate

    raise FileNotFoundError("Could not find dataset directory containing CSV files.")


def load_company_question_bank(dataset_root: Path) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []
    csv_files = sorted(dataset_root.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in: {dataset_root}")

    for csv_path in csv_files:
        try:
            df = pd.read_csv(csv_path)
        except Exception:
            continue

        required_cols = {"Title", "Difficulty", "Frequency", "Leetcode Question Link"}
        if not required_cols.issubset(df.columns):
            continue

        df = df[["Title", "Difficulty", "Frequency", "Leetcode Question Link"]].copy()
        df["Company"] = infer_company_from_filename(csv_path.name)
        df["Difficulty"] = df["Difficulty"].astype(str).str.strip().str.title()
        df["Title"] = df["Title"].astype(str).str.strip()
        df["Leetcode Question Link"] = df["Leetcode Question Link"].astype(str).str.strip()
        df["Frequency"] = pd.to_numeric(df["Frequency"], errors="coerce").fillna(0.0)

        rows.append(df)

    if not rows:
        raise ValueError("No valid company CSV files with expected columns were found.")

    data = pd.concat(rows, ignore_index=True)
    data = data[data["Title"].str.len() > 0].copy()

    # Keep the most frequent duplicate title per company.
    data = (
        data.sort_values("Frequency", ascending=False)
        .drop_duplicates(subset=["Company", "Title"], keep="first")
        .reset_index(drop=True)
    )
    return data
