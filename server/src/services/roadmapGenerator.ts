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

export interface RoadmapDay {
  day: number;
  topic: string;
  category: string;
  difficulty: string;
  resources: { title: string; url: string }[];
}

export interface RoadmapWeek {
  week: number;
  title: string;
  status: "completed" | "active" | "locked";
  days: RoadmapDay[];
  test: { unlocked: boolean; minPercentToUnlockNextWeek: number; lastPercentage?: number };
}

const DATASETS_DIR = resolve(process.cwd(), "..", "datasets");
const SKILLS_CSV = resolve(DATASETS_DIR, "job_domain_skills_dataset.csv");

let cachePromise: Promise<SkillRow[]> | null = null;

async function loadSkills(): Promise<SkillRow[]> {
  const rows: SkillRow[] = [];

  await new Promise<void>((resolvePromise, reject) => {
    createReadStream(SKILLS_CSV)
      .pipe(parse({ columns: true, bom: true, trim: true }))
      .on("data", (record: SkillRow) => {
        rows.push(record);
      })
      .on("error", reject)
      .on("end", () => resolvePromise());
  });

  return rows;
}

async function getSkills(): Promise<SkillRow[]> {
  if (!cachePromise) cachePromise = loadSkills();
  return cachePromise;
}

function priorityValue(v: string): number {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return 99;
}

function difficultyValue(v: string): number {
  const s = (v || "").toLowerCase();
  if (s.includes("beginner")) return 1;
  if (s.includes("intermediate")) return 2;
  if (s.includes("advanced")) return 3;
  return 99;
}

function importanceValue(v: string): number {
  const s = (v || "").toLowerCase();
  if (s.includes("essential")) return 1;
  if (s.includes("important")) return 2;
  if (s.includes("good")) return 3;
  return 99;
}

function weekTitleFromCategory(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("dsa")) return "DSA Core";
  if (c.includes("aptitude")) return "Aptitude";
  if (c.includes("soft")) return "Soft Skills";
  if (c.includes("frontend")) return "Frontend";
  if (c.includes("backend")) return "Backend";
  if (c.includes("database")) return "Databases";
  if (c.includes("tools")) return "Tools";
  return "Core Skills";
}

function baseResources(topic: string, category: string): { title: string; url: string }[] {
  const q = encodeURIComponent(topic);
  const links: { title: string; url: string }[] = [
    { title: "Google Search", url: `https://www.google.com/search?q=${q}` },
    { title: "GeeksforGeeks", url: `https://www.geeksforgeeks.org/search/${q}` },
  ];

  const c = category.toLowerCase();
  if (c.includes("frontend") || c.includes("backend") || c.includes("full")) {
    links.push({ title: "MDN", url: `https://developer.mozilla.org/en-US/search?q=${q}` });
    links.push({ title: "W3Schools", url: `https://www.w3schools.com/` });
  }
  if (c.includes("dsa")) {
    links.push({ title: "LeetCode", url: `https://leetcode.com/problemset/?search=${q}` });
  }
  return links;
}

export async function generateRoadmap(
  careerPath: string,
  unlockedWeek: number,
  completedDays: Set<string>,
  weeklyTestByWeek: Map<number, number>,
  skipCategories: Set<string>
): Promise<RoadmapWeek[]> {
  const all = await getSkills();

  // Domain names in CSV are not exactly same as UI labels; attempt fuzzy-ish mapping.
  const domain = careerPath;
  const rows = all.filter((r) => r.Domain_Name === domain);

  const filtered = (rows.length ? rows : all.filter((r) => r.Domain_Name === "Full Stack Developer"))
    .filter((r) => !skipCategories.has(r.Skill_Category));

  const picked = filtered
    .slice()
    .sort((a, b) => {
      return (
        priorityValue(a.Learning_Priority) - priorityValue(b.Learning_Priority) ||
        importanceValue(a.Importance_Level) - importanceValue(b.Importance_Level) ||
        difficultyValue(a.Difficulty_Level) - difficultyValue(b.Difficulty_Level) ||
        a.Skill_Category.localeCompare(b.Skill_Category) ||
        a.Topic_Name.localeCompare(b.Topic_Name)
      );
    });

  const targetDays = 84; // 12 weeks
  const items = picked.slice(0, targetDays);

  while (items.length < targetDays) {
    items.push({
      Domain_Name: domain,
      Skill_Category: "Practice",
      Topic_Name: "Practice + Revision",
      Importance_Level: "Important",
      Proficiency_Level: "Intermediate",
      Experience_Required_Years: "0",
      Difficulty_Level: "Intermediate",
      Learning_Priority: "3",
      Certification_Required: "No",
    });
  }

  const weeks: RoadmapWeek[] = [];
  for (let w = 1; w <= 12; w++) {
    const start = (w - 1) * 7;
    const slice = items.slice(start, start + 7);

    const difficultyBand = w <= 3 ? "Beginner" : w <= 6 ? "Intermediate" : w <= 9 ? "Advanced" : "Mixed";

    const days: RoadmapDay[] = slice.map((r, i) => {
      const key = `${w}-${i + 1}`;
      const topic = r.Topic_Name;
      return {
        day: i + 1,
        topic,
        category: r.Skill_Category,
        difficulty: difficultyBand === "Mixed" ? r.Difficulty_Level : difficultyBand,
        resources: baseResources(topic, r.Skill_Category),
      };
    });

    const completedCount = days.filter((d) => completedDays.has(`${w}-${d.day}`)).length;
    const weekUnlocked = w <= unlockedWeek;

    const status: RoadmapWeek["status"] =
      w < unlockedWeek ? "completed" : weekUnlocked ? "active" : "locked";

    const lastPct = weeklyTestByWeek.get(w);

    weeks.push({
      week: w,
      title: weekTitleFromCategory(days[0]?.category ?? "Core"),
      status,
      days,
      test: {
        unlocked: weekUnlocked && completedCount === 7,
        minPercentToUnlockNextWeek: 60,
        lastPercentage: lastPct,
      },
    });
  }

  return weeks;
}
