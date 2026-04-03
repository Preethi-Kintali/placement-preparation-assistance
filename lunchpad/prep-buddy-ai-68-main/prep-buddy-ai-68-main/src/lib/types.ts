export interface ResumeData {
  name: string;
  skills: string[];
  projects: string[];
  experience: string[];
  education: string[];
}

export interface CompanyProfile {
  id: string;
  name: string;
  focus_areas: string[];
  behavioral_model: string | null;
  difficulty: string;
}

export interface Questions {
  technical: string[];
  project: string[];
  behavioral: string[];
}

export interface Evaluation {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  improvement: string;
}

export interface SessionData {
  id: string;
  resume_data: ResumeData | null;
  company: string | null;
  questions: Questions | null;
  evaluations: Evaluation[] | null;
  roadmap: string | null;
  difficulty: string;
  status: string;
}

export type Step = 'company' | 'questions' | 'evaluate' | 'roadmap';
