import { useState } from "react";
import { Loader2, GraduationCap } from "lucide-react";
import { useWizard } from "@/hooks/useWizard";
import { StepIndicator } from "@/components/StepIndicator";
import { CompanySelect } from "@/components/CompanySelect";
import { InterviewQuestions } from "@/components/InterviewQuestions";
import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { RoadmapView } from "@/components/RoadmapView";
import { createSession, generateQuestions, generateRoadmap, updateSession } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { CompanyProfile, Evaluation, ResumeData } from "@/lib/types";

const Index = () => {
  const wizard = useWizard();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const emptyResume: ResumeData = {
    name: "Local Candidate",
    skills: [],
    projects: [],
    experience: [],
    education: [],
  };

  const handleCompanySelect = async (company: CompanyProfile) => {
    wizard.setCompany(company);
    setLoading(true);
    try {
      const currentSessionId = wizard.sessionId ?? (await createSession(wizard.difficulty));
      if (!wizard.sessionId) {
        wizard.setSessionId(currentSessionId);
      }

      const resumeData = wizard.resumeData ?? emptyResume;
      if (!wizard.resumeData) {
        wizard.setResumeData(resumeData);
      }

      await updateSession(currentSessionId, {
        resume_data: resumeData,
        company: company.name,
        status: "generating_questions",
      });
      const questions = await generateQuestions(resumeData, company.name, wizard.difficulty);
      wizard.setQuestions(questions);
      await updateSession(currentSessionId, { questions, status: "questions_ready" });
      wizard.goTo("questions");
    } catch (e: any) {
      toast({ title: "Error generating questions", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationComplete = async (evaluations: Evaluation[]) => {
    wizard.setEvaluations(evaluations);
    if (wizard.sessionId) {
      await updateSession(wizard.sessionId, { evaluations, status: "evaluated" });
    }
    wizard.goTo("evaluate");
  };

  const handleGenerateRoadmap = async () => {
    setLoading(true);
    try {
      if (!wizard.company) {
        throw new Error("Company is not selected");
      }

      const roadmap = await generateRoadmap(
        wizard.evaluations,
        wizard.company.name,
        wizard.resumeData ?? emptyResume
      );
      wizard.setRoadmap(roadmap);
      if (wizard.sessionId) {
        await updateSession(wizard.sessionId, { roadmap, status: "complete" });
      }
      wizard.goTo("roadmap");
    } catch (e: any) {
      toast({ title: "Error generating roadmap", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI Placement Prep</h1>
            <p className="text-xs text-muted-foreground">Your personal interview coach</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <StepIndicator current={wizard.step} />

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">AI is working on it...</p>
          </div>
        )}

        {!loading && wizard.step === "company" && (
          <CompanySelect onSelect={handleCompanySelect} />
        )}

        {!loading && wizard.step === "questions" && wizard.questions && (
          <InterviewQuestions questions={wizard.questions} onComplete={handleEvaluationComplete} />
        )}

        {!loading && wizard.step === "evaluate" && (
          <EvaluationDashboard evaluations={wizard.evaluations} onContinue={handleGenerateRoadmap} />
        )}

        {!loading && wizard.step === "roadmap" && wizard.roadmap && (
          <RoadmapView roadmap={wizard.roadmap} onReset={wizard.reset} />
        )}
      </main>
    </div>
  );
};

export default Index;
