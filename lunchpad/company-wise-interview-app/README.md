# Company-Wise Interview Simulator

This app uses your company-wise LeetCode CSV datasets and runs an adaptive interview flow.

## What It Does

- Lets you choose a company from the dataset.
- Starts a one-question-at-a-time interview.
- Uses a lightweight ML recommender (TF-IDF + nearest neighbors) to pick the next question.
- Adapts target difficulty based on your feedback (Solved / Partial / Need Hint / Skip).

## Project Structure

- `app.py`: Streamlit UI and interview flow.
- `src/data_loader.py`: Dataset discovery and CSV loading.
- `src/interview_model.py`: ML model and interview state logic.

## Run Locally

1. Open terminal in this folder:
   - `C:\MY PROJECTS\GEN AI LAUNCH PAD\company-wise-interview-app`
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Start app:
   - `streamlit run app.py`

The app auto-discovers CSV files from your workspace (including the LeetCode dataset folder).