# ML Models

This folder contains the training pipeline that builds **one RandomForest model per CSV** in `datasets/`.

## What the models do

- Takes: question text + options
- Predicts: difficulty/level label (e.g., `Level`, `Difficulty`, `Topic`, `Category`) depending on the dataset
- Saves: `ml/models/<dataset>_rf.joblib` and `ml/metrics/<dataset>_metrics.json`

## Train all models

From repo root:

- Windows (PowerShell):
  - `./.venv/Scripts/python.exe ml/train_models.py`

## Randomly sample questions for exams

Use the helper:

- `ml/question_bank.py` -> `sample_questions(dataset_name, n, label_col=..., label_value=...)`

Example (Python):

- `sample_questions("dsa_questions.csv", 15, label_col="Difficulty", label_value="Beginner")`
