from __future__ import annotations

from pathlib import Path

import streamlit as st

from src.data_loader import discover_dataset_root, load_company_question_bank
from src.interview_model import CompanyInterviewModel


st.set_page_config(page_title="Company Interview Simulator", page_icon="🧠", layout="wide")


@st.cache_resource(show_spinner=False)
def build_model() -> CompanyInterviewModel:
    root = discover_dataset_root(Path(__file__).resolve().parent)
    df = load_company_question_bank(root)
    return CompanyInterviewModel(df)


model = build_model()


def reset_interview() -> None:
    for key in ["state", "current_question", "stage"]:
        if key in st.session_state:
            del st.session_state[key]


if "stage" not in st.session_state:
    st.session_state["stage"] = "select"


st.title("Company-Wise Interview Simulator")
st.caption("Pick a company, click Continue, and get an adaptive question-by-question interview.")


if st.session_state["stage"] == "select":
    companies = model.get_companies()
    default_company = "amazon" if "amazon" in companies else companies[0]
    selected_company = st.selectbox("Select company", options=companies, index=companies.index(default_company))

    col1, col2 = st.columns([1, 1])
    with col1:
        start = st.button("Continue", type="primary", use_container_width=True)
    with col2:
        clear = st.button("Reset", use_container_width=True)

    if clear:
        reset_interview()
        st.rerun()

    if start:
        st.session_state["state"] = model.start_interview(selected_company)
        st.session_state["current_question"] = model.next_question(st.session_state["state"])
        st.session_state["stage"] = "interview"
        st.rerun()


elif st.session_state["stage"] == "interview":
    state = st.session_state["state"]
    question = st.session_state.get("current_question")

    st.subheader(f"Interview: {state.company.upper()}")

    if question is None:
        st.success("No more questions available for this company.")
        summary = model.interview_summary(state)
        st.json(summary)
        if st.button("Back to Company Selection"):
            reset_interview()
            st.session_state["stage"] = "select"
            st.rerun()
    else:
        with st.container(border=True):
            st.markdown(f"### {question['title']}")
            meta1, meta2, meta3 = st.columns(3)
            meta1.metric("Difficulty", question["difficulty"])
            meta2.metric("Frequency Score", question["frequency"])
            meta3.metric("Question #", state.asked_count)
            st.markdown(f"[Open LeetCode Problem]({question['link']})")

        st.write("How did you do on this question?")
        c1, c2, c3, c4 = st.columns(4)
        solved = c1.button("Solved", use_container_width=True)
        partial = c2.button("Partial", use_container_width=True)
        hint = c3.button("Need Hint", use_container_width=True)
        skip = c4.button("Skip", use_container_width=True)

        feedback = None
        if solved:
            feedback = "solved"
        elif partial:
            feedback = "partial"
        elif hint:
            feedback = "hint"
        elif skip:
            feedback = "skip"

        if feedback:
            model.update_after_feedback(state, feedback)
            st.session_state["current_question"] = model.next_question(state)
            st.rerun()

        st.divider()
        summary = model.interview_summary(state)
        s1, s2, s3, s4 = st.columns(4)
        s1.metric("Attempted", summary["questions_attempted"])
        s2.metric("Score", summary["score"])
        s3.metric("Readiness", summary["readiness"])
        s4.metric("Target Difficulty", summary["current_target_difficulty"])

        if st.button("End Interview"):
            st.session_state["current_question"] = None
            st.rerun()
