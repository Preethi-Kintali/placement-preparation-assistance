import type { RoadmapPlanWeek, RoadmapCategory, RoadmapPlanDay } from "../models/RoadmapPlan";
import { getDomainTopics } from "./skillsDataset";

function gfgResource(topic: string) {
  const q = encodeURIComponent(topic);
  return [{ title: "GeeksforGeeks", url: `https://www.geeksforgeeks.org/search/${q}` }];
}

function weekDifficulty(week: number): RoadmapPlanDay["difficulty"] {
  if (week <= 4) return "Beginner";
  if (week <= 8) return "Intermediate";
  return "Advanced";
}

function normalizeTopics(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

export async function buildDeterministicRoadmap(input: {
  careerPath: string;
  requirements: Record<string, any>;
}): Promise<RoadmapPlanWeek[]> {
  // We intentionally do NOT rely on Groq/LLM generation for roadmap topics.
  // Requirements may be present (from admin action), but the roadmap itself is generated
  // deterministically from our dataset + sensible defaults.
  const skills = input.requirements?.skills ?? {};

  const queues: Record<RoadmapCategory, string[]> = {
    aptitude: normalizeTopics(skills.aptitude),
    dsa: normalizeTopics(skills.dsa),
    softskills: normalizeTopics(skills.softSkills),
    tech: normalizeTopics(skills.technical),
  };

  const seen = new Set<string>();
  for (const key of Object.keys(queues) as RoadmapCategory[]) {
    queues[key] = queues[key].filter((t) => {
      const k = `${key}:${t.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // Always seed from dataset (role-specific tech stack).
  // This enables "every role in current world" as long as it exists in our dataset.
  // Note: for unknown roles, dataset helper falls back to Full Stack Developer.
  // We keep any provided queues as "priority" by unshifting them ahead of dataset topics.
  const datasetTechRowsPromise = getDomainTopics({
    careerPath: input.careerPath,
    excludeCategories: ["DSA"],
    limit: 250,
  });

  const aptitudeDefaults = [
    "Percentages",
    "Ratio & Proportion",
    "Time & Work",
    "Time, Speed & Distance",
    "Profit & Loss",
    "Averages",
    "Probability",
    "Number System",
  ];

  // DSA topics intentionally mirror the DSA question dataset "Topic" column where possible.
  const dsaDefaults = [
    "Array",
    "String Algorithms",
    "Linked List",
    "Stack",
    "Queue",
    "Sorting",
    "Searching",
    "Hash Table",
    "Greedy",
    "Divide and Conquer",
    "Tree",
    "BST",
    "AVL Tree",
    "Heap",
    "Graph",
    "Graph Traversal",
    "Shortest Path",
    "MST",
    "Dynamic Programming",
    "Backtracking",
    "Recursion",
    "Two Pointers",
    "Sliding Window",
    "Bit Manipulation",
  ];

  const softDefaults = [
    "Communication",
    "Presentation",
    "Teamwork",
    "Conflict Management",
    "Time Management",
    "Leadership",
    "Networking",
    "Interview HR Questions",
  ];

  // Fill missing queues with defaults (medium aptitude/soft; heavy tech+dsa handled by schedule)
  if (!queues.aptitude.length) queues.aptitude = aptitudeDefaults.slice();
  if (!queues.dsa.length) queues.dsa = dsaDefaults.slice();
  if (!queues.softskills.length) queues.softskills = softDefaults.slice();

  const weeks: RoadmapPlanWeek[] = [];

  // Tech + DSA heavy plan:
  // - Tech: 4/7 days
  // - DSA: 2/7 days
  // - Aptitude/SoftSkills: 1/7 day (alternating)
  const dayCategoriesForWeek = (week: number): RoadmapCategory[] => {
    const last = week % 2 === 1 ? "aptitude" : "softskills";
    return ["tech", "tech", "dsa", "tech", "dsa", "tech", last];
  };

  const pickTopic = (preferred: RoadmapCategory): { category: RoadmapCategory; topic: string } => {
    const preferredTopic = queues[preferred].shift();
    if (preferredTopic) return { category: preferred, topic: preferredTopic };

    // If preferred is empty, pick first non-empty (prioritize tech first)
    const fallbackOrder: RoadmapCategory[] = ["tech", "dsa", "aptitude", "softskills"];
    const alt = fallbackOrder.find((c) => queues[c].length > 0);
    const topic = alt ? queues[alt].shift() : undefined;
    return { category: alt ?? preferred, topic: topic ?? "Practice + Revision" };
  };

  // Seed tech topics from dataset now.
  // If dataset load fails for any reason, we still have a minimal tech fallback.
  const techFallback = [
    "Git",
    "HTTP & REST APIs",
    "Databases (SQL/NoSQL)",
    "Authentication (JWT)",
    "Testing Basics",
    "System Design Basics",
  ];

  try {
    const datasetTechRows = await datasetTechRowsPromise;
    const datasetTopics = datasetTechRows.map((r) => String(r.Topic_Name ?? "").trim()).filter(Boolean);
    const merged = [...queues.tech, ...datasetTopics];
    const seenTech = new Set<string>();
    queues.tech = merged.filter((t) => {
      const k = t.toLowerCase();
      if (seenTech.has(k)) return false;
      seenTech.add(k);
      return true;
    });
  } catch {
    if (!queues.tech.length) queues.tech = techFallback.slice();
  }

  if (!queues.tech.length) queues.tech = techFallback.slice();

  for (let week = 1; week <= 12; week++) {
    const diff = weekDifficulty(week);
    const days: RoadmapPlanDay[] = [];

    const dayCats = dayCategoriesForWeek(week);
    for (let day = 1; day <= 7; day++) {
      const desired = dayCats[day - 1];
      const { category, topic } = pickTopic(desired);
      days.push({ day, topic, category, difficulty: diff, resources: gfgResource(topic) });
    }

    weeks.push({ week, title: `Week ${week}`, days });
  }

  return weeks;
}
