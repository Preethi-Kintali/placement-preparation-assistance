import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse";

export interface SkillRow {
  Domain_Name: string;
  Skill_Category: string;
  Topic_Name: string;
  Importance_Level: string;
  Proficiency_Level: string;
  Experience_Required_Years: string;
  Difficulty_Level: string;
  Learning_Priority: string;
  Certification_Required: string;
}

const DATASETS_DIR = resolve(process.cwd(), "..", "datasets");
const SKILLS_CSV = resolve(DATASETS_DIR, "job_domain_skills_dataset.csv");

let cachePromise: Promise<SkillRow[]> | null = null;

async function loadSkills(): Promise<SkillRow[]> {
  const rows: SkillRow[] = [];

  await new Promise<void>((resolvePromise, reject) => {
    createReadStream(SKILLS_CSV)
      .pipe(parse({ columns: true, bom: true, trim: true }))
      .on("data", (record: SkillRow) => rows.push(record))
      .on("error", reject)
      .on("end", () => resolvePromise());
  });

  return rows;
}

export async function getAllSkills(): Promise<SkillRow[]> {
  if (!cachePromise) cachePromise = loadSkills();
  return cachePromise;
}

export async function getCareerPathsFromDataset(): Promise<string[]> {
  const all = await getAllSkills();
  const set = new Set<string>();
  for (const r of all) {
    const name = String(r.Domain_Name ?? "").trim();
    if (name) set.add(name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function priorityValue(v: string): number {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return 99;
}

function difficultyValue(v: string): number {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("beginner")) return 1;
  if (s.includes("intermediate")) return 2;
  if (s.includes("advanced")) return 3;
  return 99;
}

function importanceValue(v: string): number {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("essential")) return 1;
  if (s.includes("important")) return 2;
  if (s.includes("good")) return 3;
  return 99;
}

export async function getDomainTopics(input: {
  careerPath: string;
  includeCategories?: string[];
  excludeCategories?: string[];
  limit?: number;
}): Promise<SkillRow[]> {
  const all = await getAllSkills();
  const domain = input.careerPath;

  const include = new Set((input.includeCategories ?? []).map((s) => s.toLowerCase()));
  const exclude = new Set((input.excludeCategories ?? []).map((s) => s.toLowerCase()));

  let rows = all.filter((r) => String(r.Domain_Name) === domain);
  if (!rows.length) {
    rows = all.filter((r) => String(r.Domain_Name) === "Full Stack Developer");
  }

  if (include.size) {
    rows = rows.filter((r) => include.has(String(r.Skill_Category ?? "").toLowerCase()));
  }
  if (exclude.size) {
    rows = rows.filter((r) => !exclude.has(String(r.Skill_Category ?? "").toLowerCase()));
  }

  const sorted = rows
    .slice()
    .sort((a, b) => {
      return (
        priorityValue(a.Learning_Priority) - priorityValue(b.Learning_Priority) ||
        importanceValue(a.Importance_Level) - importanceValue(b.Importance_Level) ||
        difficultyValue(a.Difficulty_Level) - difficultyValue(b.Difficulty_Level) ||
        String(a.Skill_Category).localeCompare(String(b.Skill_Category)) ||
        String(a.Topic_Name).localeCompare(String(b.Topic_Name))
      );
    });

  const limit = Math.max(1, Math.min(input.limit ?? sorted.length, sorted.length));
  return sorted.slice(0, limit);
}
