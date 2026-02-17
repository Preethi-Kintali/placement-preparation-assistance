from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import joblib
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


ROOT = Path(__file__).resolve().parents[1]
DATASETS_DIR = ROOT / "datasets"
MODELS_DIR = Path(__file__).resolve().parent / "models"
METRICS_DIR = Path(__file__).resolve().parent / "metrics"


LABEL_CANDIDATES = [
    "Level",  # most domain datasets
    "Difficulty",  # dsa + soft_skills
    "Category",  # soft_skills
    "Topic",  # aptitude, dsa
]


@dataclass(frozen=True)
class DatasetSpec:
    path: Path
    label_col: str
    text_cols: list[str]


def _first_existing(cols: Iterable[str], candidates: list[str]) -> str | None:
    lower = {c.lower(): c for c in cols}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    return None


def infer_dataset_spec(csv_path: Path) -> DatasetSpec | None:
    df = pd.read_csv(csv_path)
    cols = list(df.columns)

    label_col = _first_existing(cols, LABEL_CANDIDATES)
    if label_col is None:
        return None

    # question datasets use either Option_1..4 or Option_A..D
    question_col = _first_existing(cols, ["Question"])
    if question_col is None:
        return None

    option_cols = []
    if _first_existing(cols, ["Option_1"]) is not None:
        option_cols = [
            _first_existing(cols, ["Option_1"]),
            _first_existing(cols, ["Option_2"]),
            _first_existing(cols, ["Option_3"]),
            _first_existing(cols, ["Option_4"]),
        ]
    elif _first_existing(cols, ["Option_A"]) is not None:
        option_cols = [
            _first_existing(cols, ["Option_A"]),
            _first_existing(cols, ["Option_B"]),
            _first_existing(cols, ["Option_C"]),
            _first_existing(cols, ["Option_D"]),
        ]

    option_cols = [c for c in option_cols if c]
    text_cols = [question_col, *option_cols]

    if len(text_cols) < 2:
        return None

    return DatasetSpec(path=csv_path, label_col=label_col, text_cols=text_cols)


def build_pipeline(random_state: int = 42) -> Pipeline:
    return Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_features=80_000,
                    strip_accents="unicode",
                    lowercase=True,
                ),
            ),
            # RF cannot consume sparse; reduce dimensionality first.
            ("svd", TruncatedSVD(n_components=250, random_state=random_state)),
            (
                "rf",
                RandomForestClassifier(
                    n_estimators=600,
                    random_state=random_state,
                    n_jobs=-1,
                    class_weight="balanced_subsample",
                ),
            ),
        ]
    )


def train_one(spec: DatasetSpec, test_size: float = 0.2, random_state: int = 42) -> dict:
    df = pd.read_csv(spec.path)

    df = df.dropna(subset=[spec.label_col, *spec.text_cols]).copy()
    text = df[spec.text_cols].astype(str).agg("\n".join, axis=1)
    y = df[spec.label_col].astype(str)

    if y.nunique() < 2:
        raise ValueError(f"Not enough classes in {spec.path.name}: {y.unique().tolist()}")

    X_train, X_test, y_train, y_test = train_test_split(
        text,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    pipe = build_pipeline(random_state=random_state)

    # Fit with a safe SVD size based on training-set feature size
    pipe.fit(X_train, y_train)

    preds = pipe.predict(X_test)
    acc = float(accuracy_score(y_test, preds))

    model_name = spec.path.stem + "_rf.joblib"
    model_path = MODELS_DIR / model_name
    joblib.dump(pipe, model_path)

    metrics = {
        "dataset": spec.path.name,
        "rows": int(df.shape[0]),
        "label_col": spec.label_col,
        "text_cols": spec.text_cols,
        "classes": sorted(y.unique().tolist()),
        "accuracy": acc,
        "model_path": str(model_path.relative_to(ROOT)).replace("\\", "/"),
        "classification_report": classification_report(y_test, preds, output_dict=True, zero_division=0),
    }

    metrics_path = METRICS_DIR / (spec.path.stem + "_metrics.json")
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    return metrics


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    METRICS_DIR.mkdir(parents=True, exist_ok=True)

    csvs = sorted(DATASETS_DIR.glob("*.csv"))
    if not csvs:
        raise SystemExit(f"No CSVs found in {DATASETS_DIR}")

    results: list[dict] = []
    skipped: list[str] = []

    for csv_path in csvs:
        spec = infer_dataset_spec(csv_path)
        if spec is None:
            skipped.append(csv_path.name)
            continue

        print(f"\nTraining: {csv_path.name} | label={spec.label_col}")
        metrics = train_one(spec)
        print(f"accuracy={metrics['accuracy']:.4f} -> {metrics['model_path']}")
        results.append(metrics)

    summary = {
        "trained": len(results),
        "skipped": skipped,
        "min_accuracy": min((r["accuracy"] for r in results), default=None),
        "results": [{"dataset": r["dataset"], "accuracy": r["accuracy"], "model": r["model_path"]} for r in results],
    }
    (METRICS_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\n=== Summary ===")
    print(f"trained: {summary['trained']}")
    print(f"skipped: {len(skipped)} -> {skipped}")
    print(f"min_accuracy: {summary['min_accuracy']}")

    # fail fast if accuracy target not met
    if summary["min_accuracy"] is not None and summary["min_accuracy"] < 0.90:
        raise SystemExit("One or more models are below 0.90 accuracy; tune parameters.")


if __name__ == "__main__":
    main()
