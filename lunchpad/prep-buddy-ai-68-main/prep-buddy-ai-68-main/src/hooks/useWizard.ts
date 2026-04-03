import { useState, useCallback } from "react";
import type { Step, ResumeData, Questions, Evaluation, CompanyProfile } from "@/lib/types";

export function useWizard() {
  const [step, setStep] = useState<Step>("company");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [difficulty, setDifficulty] = useState("Medium");
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [roadmap, setRoadmap] = useState<string | null>(null);

  const goTo = useCallback((s: Step) => setStep(s), []);

  const reset = useCallback(() => {
    setStep("company");
    setSessionId(null);
    setResumeData(null);
    setCompany(null);
    setQuestions(null);
    setEvaluations([]);
    setRoadmap(null);
  }, []);

  return {
    step, goTo, sessionId, setSessionId,
    resumeData, setResumeData,
    company, setCompany,
    difficulty, setDifficulty,
    questions, setQuestions,
    evaluations, setEvaluations,
    roadmap, setRoadmap,
    reset,
  };
}
