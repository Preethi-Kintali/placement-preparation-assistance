import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse";

export type ExamType = "aptitude" | "dsa" | "soft_skills" | "career";

export interface QuestionDTO {
  id: string;
  question: string;
  options: string[];
}

export interface QuestionRow {
  id: string;
  question: string;
  options: string[];
  correctOption: string;
  meta: Record<string, string>;
}

const DATASETS_DIR = resolve(process.cwd(), "..", "datasets");

const datasetByExam: Record<Exclude<ExamType, "career">, string> = {
  aptitude: "quantitative_aptitude_questions.csv",
  dsa: "dsa_questions.csv",
  soft_skills: "soft_skills_questions.csv",
};

const careerDatasetByPath: Record<string, string> = {
  "Full Stack Developer": "full_stack_development_questions.csv",
  "Frontend Developer": "full_stack_development_questions.csv",
  "Backend Developer": "full_stack_development_questions.csv",
  "Java Developer": "full_stack_development_questions.csv",
  "Python Developer": "full_stack_development_questions.csv",
  "DevOps Engineer": "cloud_computing_devops_questions.csv",
  "Data Analyst": "data_science_questions.csv",
  "Data Scientist": "data_science_questions.csv",
  "ML Engineer": "machine_learning_questions.csv",
  "Machine Learning Engineer": "machine_learning_questions.csv",
  "AI Engineer": "artificial_intelligence_questions.csv",
  "GenAI Developer": "generative_ai_questions.csv",
  "Cybersecurity Engineer": "cybersecurity_questions.csv",
  "Blockchain Developer": "blockchain_development_questions.csv",
  "IoT Developer": "iot_development_questions.csv",
  "AR/VR Developer": "ar_vr_development_questions.csv",
  "Mobile Developer": "mobile_app_development_questions.csv",
  "App Developer": "mobile_app_development_questions.csv",
};

function datasetForCareerPath(careerPath: string): string {
  const direct = careerDatasetByPath[careerPath];
  if (direct) return direct;

  const s = String(careerPath ?? "").toLowerCase();
  if (s.includes("devops") || s.includes("cloud") || s.includes("sre") || s.includes("platform")) {
    return "cloud_computing_devops_questions.csv";
  }
  if (s.includes("data") || s.includes("analytics") || s.includes("bi") || s.includes("business analyst")) {
    return "data_science_questions.csv";
  }
  if (s.includes("ml") || s.includes("machine learning")) {
    return "machine_learning_questions.csv";
  }
  if (s.includes("ai") || s.includes("artificial intelligence")) {
    return "artificial_intelligence_questions.csv";
  }
  if (s.includes("genai") || s.includes("generative") || s.includes("llm")) {
    return "generative_ai_questions.csv";
  }
  if (s.includes("cyber") || s.includes("security") || s.includes("soc")) {
    return "cybersecurity_questions.csv";
  }
  if (s.includes("blockchain") || s.includes("web3")) {
    return "blockchain_development_questions.csv";
  }
  if (s.includes("iot") || s.includes("embedded")) {
    return "iot_development_questions.csv";
  }
  if (s.includes("ar") || s.includes("vr") || s.includes("xr")) {
    return "ar_vr_development_questions.csv";
  }
  if (s.includes("mobile") || s.includes("android") || s.includes("ios") || s.includes("flutter") || s.includes("react native")) {
    return "mobile_app_development_questions.csv";
  }

  // Default: general full-stack/dev questions are the best fallback.
  return "full_stack_development_questions.csv";
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeRow(row: Record<string, string>): QuestionRow | null {
  const cols = Object.keys(row);
  if (!cols.includes("Question")) return null;

  // Option_1..4 format
  if (cols.includes("Option_1") && cols.includes("Option_2") && cols.includes("Option_3") && cols.includes("Option_4")) {
    const id = row["Question_ID"] || row["Record_ID"] || row["Question"];
    const options = [row["Option_1"], row["Option_2"], row["Option_3"], row["Option_4"]].map(String);
    const correctRaw = String(row["Correct_Answer"] || row["Correct_A"] || "");
    const m = correctRaw.match(/option_(\d)/i);
    const idx = m ? Number(m[1]) - 1 : -1;
    const correct = idx >= 0 && idx < options.length ? options[idx] : correctRaw;
    return {
      id: String(id),
      question: String(row["Question"]),
      options,
      correctOption: correct,
      meta: row,
    };
  }

  // Option_A..D format
  if (cols.includes("Option_A") && cols.includes("Option_B") && cols.includes("Option_C") && cols.includes("Option_D")) {
    const id = row["Question_ID"] || row["Record_ID"] || row["Question"];
    const options = [row["Option_A"], row["Option_B"], row["Option_C"], row["Option_D"]].map(String);
    const correctRaw = String(row["Correct_Option"] || "");
    const letter = correctRaw.trim().toUpperCase();
    const letterIdx = letter === "A" ? 0 : letter === "B" ? 1 : letter === "C" ? 2 : letter === "D" ? 3 : -1;
    const correct = letterIdx >= 0 && letterIdx < options.length ? options[letterIdx] : correctRaw;
    return {
      id: String(id),
      question: String(row["Question"]),
      options,
      correctOption: correct,
      meta: row,
    };
  }

  return null;
}

async function loadCsv(filename: string): Promise<QuestionRow[]> {
  const filePath = resolve(DATASETS_DIR, filename);

  const rows: QuestionRow[] = [];
  await new Promise<void>((resolvePromise, reject) => {
    createReadStream(filePath)
      .pipe(parse({ columns: true, bom: true, trim: true }))
      .on("data", (record: Record<string, string>) => {
        const normalized = normalizeRow(record);
        if (normalized) rows.push(normalized);
      })
      .on("error", reject)
      .on("end", () => resolvePromise());
  });

  return rows;
}

const cache = new Map<string, Promise<QuestionRow[]>>();
const idToTopicCache = new Map<string, Promise<Map<string, string>>>();

async function getDataset(filename: string): Promise<QuestionRow[]> {
  if (!cache.has(filename)) cache.set(filename, loadCsv(filename));
  return cache.get(filename)!;
}

function topicFromRow(row: QuestionRow): string {
  const meta = row.meta || {};
  return (
    String(meta["Topic"] ?? "") ||
    String(meta["Category"] ?? "") ||
    String(meta["Skill_Category"] ?? "") ||
    String(meta["Level"] ?? "") ||
    row.question
  );
}

async function getIdToTopicMap(filename: string): Promise<Map<string, string>> {
  if (!idToTopicCache.has(filename)) {
    idToTopicCache.set(
      filename,
      getDataset(filename).then((rows) => {
        const map = new Map<string, string>();
        for (const r of rows) map.set(String(r.id), topicFromRow(r));
        return map;
      })
    );
  }
  return idToTopicCache.get(filename)!;
}

export type QuestionFilter = {
  labelCol?: string;
  labelValue?: string;
};

export async function getQuestionsForExam(
  examType: Exclude<ExamType, "career">,
  count: number,
  filter?: QuestionFilter
): Promise<QuestionRow[]> {
  const filename = datasetByExam[examType];
  const all = await getDataset(filename);

  let filtered = all;
  if (filter?.labelCol && typeof filter.labelValue === "string") {
    filtered = all.filter((q) => String(q.meta[filter.labelCol!]) === String(filter.labelValue));
  }

  const take = Math.min(count, filtered.length);
  return shuffle(filtered.slice()).slice(0, take);
}

export async function getCareerQuestions(
  careerPath: string,
  count: number,
  filter?: QuestionFilter
): Promise<QuestionRow[]> {
  const filename = datasetForCareerPath(careerPath);
  const all = await getDataset(filename);

  let filtered = all;
  if (filter?.labelCol && typeof filter.labelValue === "string") {
    filtered = all.filter((q) => String(q.meta[filter.labelCol!]) === String(filter.labelValue));
  }

  const take = Math.min(count, filtered.length);
  return shuffle(filtered.slice()).slice(0, take);
}

export async function getQuestionTopicById(
  examType: ExamType,
  questionId: string,
  careerPath?: string
): Promise<string | null> {
  if (examType === "career") {
    const filename = datasetForCareerPath(careerPath ?? "Full Stack Developer");
    const map = await getIdToTopicMap(filename);
    return map.get(String(questionId)) ?? null;
  }
  const filename = datasetByExam[examType];
  const map = await getIdToTopicMap(filename);
  return map.get(String(questionId)) ?? null;
}

export function toPublicQuestion(q: QuestionRow): QuestionDTO {
  return { id: q.id, question: q.question, options: q.options };
}
