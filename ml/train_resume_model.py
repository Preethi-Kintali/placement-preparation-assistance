"""
═══════════════════════════════════════════════════════════════════
  Resume Classification Model — TF-IDF + LinearSVC
  Dataset: datasets for resume anylsis/UpdatedResumeDataSet.csv
  Target: ≥90% accuracy
═══════════════════════════════════════════════════════════════════
"""

import os, sys, json, re, time
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
import joblib

# ── Paths ────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "datasets for resume anylsis", "UpdatedResumeDataSet.csv")
MODEL_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
METRIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "metrics")

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(METRIC_DIR, exist_ok=True)

# ── 1. Load & Clean ────────────────────────────────────────────
print("═" * 60)
print("  Resume Classification — TF-IDF + LinearSVC")
print("═" * 60)

df = pd.read_csv(DATA_PATH)
print(f"\n[1] Loaded {len(df)} rows  |  Columns: {list(df.columns)}")
print(f"    Categories: {df['Category'].nunique()} unique")
print(f"    Top categories:\n{df['Category'].value_counts().head(10).to_string()}\n")

# Clean text
def clean_text(text):
    text = str(text)
    text = re.sub(r'http\S+', ' ', text)           # URLs
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)       # non-alpha
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text

df['clean_resume'] = df['Resume'].apply(clean_text)
df = df[df['clean_resume'].str.len() > 50]  # drop very short
print(f"[2] After cleaning: {len(df)} rows")

# ── 2. Encode Labels ────────────────────────────────────────────
le = LabelEncoder()
df['label'] = le.fit_transform(df['Category'])
print(f"[3] Labels encoded: {len(le.classes_)} classes")
for i, c in enumerate(le.classes_):
    count = (df['label'] == i).sum()
    print(f"    {i:2d}: {c} ({count})")

# ── 3. Train/Test Split ─────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    df['clean_resume'], df['label'],
    test_size=0.2, random_state=42, stratify=df['label']
)
print(f"\n[4] Split: {len(X_train)} train / {len(X_test)} test")

# ── 4. Build Pipeline: TF-IDF + LinearSVC ───────────────────────
print("[5] Training TF-IDF + LinearSVC pipeline...")
t0 = time.time()

pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),
        stop_words='english',
        sublinear_tf=True,
        min_df=2,
        max_df=0.95,
    )),
    ('svc', LinearSVC(
        C=1.0,
        max_iter=10000,
        class_weight='balanced',
        random_state=42,
    )),
])

pipeline.fit(X_train, y_train)
elapsed = time.time() - t0
print(f"    Training completed in {elapsed:.1f}s")

# ── 5. Evaluate ─────────────────────────────────────────────────
y_pred = pipeline.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
report = classification_report(y_test, y_pred, target_names=le.classes_, output_dict=True)

print(f"\n[6] ══ RESULTS ══")
print(f"    Accuracy: {accuracy * 100:.2f}%")
print(f"\n{classification_report(y_test, y_pred, target_names=le.classes_)}")

if accuracy < 0.90:
    print("⚠️  WARNING: Accuracy is below 90%!")
else:
    print("✅ Accuracy target met (≥90%)")

# ── 6. Save Model + Artifacts ───────────────────────────────────
print("\n[7] Saving model artifacts...")

joblib.dump(pipeline,  os.path.join(MODEL_DIR, "resume_classifier_pipeline.joblib"))
joblib.dump(le,        os.path.join(MODEL_DIR, "resume_label_encoder.joblib"))

# Save categories list as JSON for the TypeScript server to load
categories_path = os.path.join(MODEL_DIR, "resume_categories.json")
with open(categories_path, 'w') as f:
    json.dump(list(le.classes_), f, indent=2)

# Save metrics
metrics = {
    "accuracy": round(accuracy, 4),
    "num_classes": len(le.classes_),
    "categories": list(le.classes_),
    "train_size": len(X_train),
    "test_size": len(X_test),
    "tfidf_features": pipeline.named_steps['tfidf'].max_features,
    "per_class": {}
}
for cls in le.classes_:
    if cls in report:
        metrics["per_class"][cls] = {
            "precision": round(report[cls]["precision"], 4),
            "recall":    round(report[cls]["recall"], 4),
            "f1":        round(report[cls]["f1-score"], 4),
            "support":   int(report[cls]["support"]),
        }

metrics_path = os.path.join(METRIC_DIR, "resume_classifier_metrics.json")
with open(metrics_path, 'w') as f:
    json.dump(metrics, f, indent=2)

print(f"    ✅ Pipeline  → {os.path.join(MODEL_DIR, 'resume_classifier_pipeline.joblib')}")
print(f"    ✅ Encoder   → {os.path.join(MODEL_DIR, 'resume_label_encoder.joblib')}")
print(f"    ✅ Categories→ {categories_path}")
print(f"    ✅ Metrics   → {metrics_path}")
print(f"\n{'═' * 60}")
print(f"  DONE • Accuracy = {accuracy * 100:.2f}%")
print(f"{'═' * 60}")
