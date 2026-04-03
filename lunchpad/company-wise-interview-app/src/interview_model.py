from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors


DIFFICULTY_TO_LEVEL = {"Easy": 1, "Medium": 2, "Hard": 3}
LEVEL_TO_DIFFICULTY = {1: "Easy", 2: "Medium", 3: "Hard"}


@dataclass
class InterviewState:
    company: str
    target_level: int = 2
    asked_indices: Optional[set[int]] = None
    current_index: Optional[int] = None
    score: float = 0.0
    asked_count: int = 0

    def __post_init__(self) -> None:
        if self.asked_indices is None:
            self.asked_indices = set()


class CompanyInterviewModel:
    def __init__(self, df: pd.DataFrame) -> None:
        self.df = df.copy()
        self.df["Level"] = self.df["Difficulty"].map(DIFFICULTY_TO_LEVEL).fillna(2).astype(int)
        self.by_company: Dict[str, pd.DataFrame] = {
            company: subset.reset_index(drop=True)
            for company, subset in self.df.groupby("Company", sort=True)
        }
        self.models: Dict[str, tuple[TfidfVectorizer, NearestNeighbors, np.ndarray]] = {}
        self._train_company_models()

    def _train_company_models(self) -> None:
        for company, subset in self.by_company.items():
            # Add difficulty token into text to preserve difficulty-aware similarity.
            text_series = (
                subset["Title"].astype(str)
                + " difficulty_"
                + subset["Difficulty"].astype(str).str.lower()
            )
            vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1)
            matrix = vectorizer.fit_transform(text_series)
            nn = NearestNeighbors(metric="cosine", n_neighbors=min(20, len(subset)))
            nn.fit(matrix)
            self.models[company] = (vectorizer, nn, matrix)

    def get_companies(self) -> List[str]:
        return sorted(self.by_company.keys())

    def start_interview(self, company: str) -> InterviewState:
        return InterviewState(company=company)

    def _filter_unasked_by_level(
        self, subset: pd.DataFrame, asked: set[int], target_level: int
    ) -> pd.DataFrame:
        candidate = subset[~subset.index.isin(asked)]
        level_match = candidate[candidate["Level"] == target_level]
        if not level_match.empty:
            return level_match
        level_near = candidate[(candidate["Level"] >= target_level - 1) & (candidate["Level"] <= target_level + 1)]
        if not level_near.empty:
            return level_near
        return candidate

    def next_question(self, state: InterviewState) -> Optional[dict]:
        subset = self.by_company.get(state.company)
        if subset is None or subset.empty:
            return None

        remaining = subset[~subset.index.isin(state.asked_indices)]
        if remaining.empty:
            return None

        candidates = self._filter_unasked_by_level(subset, state.asked_indices, state.target_level)

        if state.current_index is None:
            # Start with the most frequent medium-level question where possible.
            pick = candidates.sort_values(["Frequency", "Level"], ascending=[False, True]).iloc[0]
            idx = int(pick.name)
        else:
            vectorizer, nn, matrix = self.models[state.company]
            distances, neighbors = nn.kneighbors(matrix[state.current_index], return_distance=True)
            idx = None
            for dist, neighbor_idx in zip(distances[0], neighbors[0]):
                if int(neighbor_idx) in state.asked_indices:
                    continue
                row = subset.iloc[int(neighbor_idx)]
                # Blend similarity, frequency, and level distance into a rank score.
                similarity_score = 1.0 - float(dist)
                level_penalty = abs(int(row["Level"]) - state.target_level) * 0.15
                frequency_bonus = float(row["Frequency"]) * 0.02
                rank_score = similarity_score + frequency_bonus - level_penalty
                if rank_score > 0:
                    idx = int(neighbor_idx)
                    break

            if idx is None:
                pick = candidates.sort_values("Frequency", ascending=False).iloc[0]
                idx = int(pick.name)

        row = subset.iloc[idx]
        state.current_index = idx
        state.asked_indices.add(idx)
        state.asked_count += 1

        return {
            "title": row["Title"],
            "difficulty": row["Difficulty"],
            "frequency": round(float(row["Frequency"]), 3),
            "link": row["Leetcode Question Link"],
            "company": row["Company"],
            "index": idx,
        }

    def update_after_feedback(self, state: InterviewState, feedback: str) -> None:
        feedback = feedback.strip().lower()
        if feedback == "solved":
            state.score += 1.0
            state.target_level = min(3, state.target_level + 1)
        elif feedback == "partial":
            state.score += 0.5
        elif feedback == "hint":
            state.score += 0.2
            state.target_level = max(1, state.target_level - 1)
        elif feedback == "skip":
            state.target_level = max(1, state.target_level - 1)

    def interview_summary(self, state: InterviewState) -> dict:
        if state.asked_count == 0:
            readiness = "No attempt yet"
        else:
            ratio = state.score / state.asked_count
            if ratio >= 0.8:
                readiness = "Strong"
            elif ratio >= 0.5:
                readiness = "Moderate"
            else:
                readiness = "Needs practice"
        return {
            "company": state.company,
            "questions_attempted": state.asked_count,
            "score": round(state.score, 2),
            "readiness": readiness,
            "current_target_difficulty": LEVEL_TO_DIFFICULTY[state.target_level],
        }
