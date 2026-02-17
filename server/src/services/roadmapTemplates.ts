import type { RoadmapCategory, RoadmapPlanDay, RoadmapPlanWeek } from "../models/RoadmapPlan";
import { RoadmapTemplate } from "../models/RoadmapTemplate";
import { buildDeterministicRoadmap } from "./deterministicRoadmap";

function gfgResource(topic: string) {
  const q = encodeURIComponent(topic);
  return [{ title: "GeeksforGeeks", url: `https://www.geeksforgeeks.org/search/${q}` }];
}

function weekDifficulty(week: number): RoadmapPlanDay["difficulty"] {
  if (week <= 4) return "Beginner";
  if (week <= 8) return "Intermediate";
  return "Advanced";
}

function inferCategory(topic: string): RoadmapCategory {
  const t = String(topic ?? "").trim().toLowerCase();
  if (t.startsWith("dsa:")) return "dsa";
  if (t.startsWith("aptitude:")) return "aptitude";
  if (t.startsWith("soft skills:") || t.startsWith("softskills:")) return "softskills";
  return "tech";
}

function toWeek(week: number, days: string[]): RoadmapPlanWeek {
  const diff = weekDifficulty(week);
  return {
    week,
    title: `Week ${week}`,
    days: days.slice(0, 7).map((raw, idx) => {
      const topic = String(raw ?? "").trim();
      return {
        day: idx + 1,
        topic,
        category: inferCategory(topic),
        difficulty: diff,
        resources: gfgResource(topic),
      };
    }),
  };
}

export function fullStackStaticTemplateWeeks(): RoadmapPlanWeek[] {
  // Matches the example pipeline/spec you provided (heavy full stack + heavy DSA; medium aptitude + soft skills).
  // Stored as a template in DB, then copied to each user plan.
  return [
    toWeek(1, [
      "HTML5 Fundamentals & Semantic Tags",
      "CSS3 Basics & Box Model",
      "Flexbox & Responsive Design",
      "JavaScript Basics (Variables, Data Types, Operators)",
      "JavaScript Functions & Scope",
      "DSA: Time & Space Complexity (Big-O)",
      "Aptitude: Quantitative Basics + Communication Fundamentals",
    ]),
    toWeek(2, [
      "Advanced JavaScript (Closures, Hoisting)",
      "DOM Manipulation",
      "ES6+ Features",
      "Asynchronous JS (Promises, Async/Await)",
      "Git & GitHub",
      "DSA: Arrays (Problems + Patterns)",
      "Soft Skills: Resume Building + Logical Reasoning",
    ]),
    toWeek(3, [
      "React Basics (Components, Props)",
      "React State & Lifecycle",
      "React Hooks (useState, useEffect)",
      "React Router",
      "React Forms & Validation",
      "DSA: Strings (Problems + Patterns)",
      "Aptitude: Percentages, Profit & Loss",
    ]),
    toWeek(4, [
      "Advanced React (Context API)",
      "Redux / State Management",
      "Frontend Project Structure & Best Practices",
      "API Integration using Axios/Fetch",
      "Mini Frontend Project",
      "DSA: Recursion (Concept + Problems)",
      "Soft Skills: Presentation Skills + Group Discussion",
    ]),
    toWeek(5, [
      "Node.js Fundamentals",
      "Express.js Basics",
      "REST API Development",
      "Middleware & Error Handling",
      "Authentication (JWT)",
      "DSA: Linked List (Problems)",
      "Aptitude: Time & Work + Time & Distance",
    ]),
    toWeek(6, [
      "MongoDB Basics",
      "Mongoose & Schema Design",
      "CRUD Operations",
      "Database Indexing & Optimization",
      "Backend Project (API + DB Integration)",
      "DSA: Stack & Queue",
      "Soft Skills: Behavioral Interview Preparation",
    ]),
    toWeek(7, [
      "System Design Basics",
      "MVC Architecture",
      "Full Stack Authentication Flow",
      "File Upload & Cloud Storage",
      "Deployment (Render/Vercel/AWS Basics)",
      "DSA: Trees (Binary Trees + Traversals)",
      "Aptitude: Probability & Permutations",
    ]),
    toWeek(8, [
      "Advanced Backend (Caching, Redis Basics)",
      "WebSockets & Real-Time Apps",
      "Testing (Jest / Unit Testing)",
      "CI/CD Basics",
      "Security Best Practices (OWASP)",
      "DSA: Binary Search & Searching Techniques",
      "Soft Skills: HR Interview Questions Practice",
    ]),
    toWeek(9, [
      "TypeScript Basics",
      "Next.js Fundamentals",
      "Server-Side Rendering",
      "Microservices Basics",
      "Docker Fundamentals",
      "DSA: Sorting Algorithms",
      "Aptitude: Data Interpretation",
    ]),
    toWeek(10, [
      "GraphQL Basics",
      "Advanced Database Design",
      "Scalability Concepts",
      "Performance Optimization",
      "Major Full Stack Project Planning",
      "DSA: Dynamic Programming (Basics)",
      "Soft Skills: Mock Technical Interview",
    ]),
    toWeek(11, [
      "Major Full Stack Project - Frontend",
      "Major Full Stack Project - Backend",
      "Major Full Stack Project - Integration",
      "Project Testing & Optimization",
      "Deployment & Monitoring",
      "DSA: Graphs (BFS, DFS)",
      "Aptitude: Logical Reasoning + Puzzles",
    ]),
    toWeek(12, [
      "Revision: Frontend Concepts",
      "Revision: Backend Concepts",
      "Revision: Databases & System Design",
      "Revision: Core JavaScript & TypeScript",
      "DSA: Mixed Problem Solving (Hard Level)",
      "Aptitude Full-Length Practice Test",
      "Soft Skills: Final Interview Simulation + Confidence Building",
    ]),
  ];
}

function staticTemplateForCareerPath(careerPath: string): RoadmapPlanWeek[] | null {
  const cp = String(careerPath ?? "").trim().toLowerCase();
  if (cp === "full stack developer" || cp.includes("full stack")) {
    return fullStackStaticTemplateWeeks();
  }
  return null;
}

export async function getOrCreateRoadmapTemplateWeeks(careerPath: string): Promise<{ weeks: RoadmapPlanWeek[]; provider: "deterministic" | "csv" }> {
  const cp = String(careerPath ?? "").trim();
  const existing =
    (await RoadmapTemplate.findOne({ careerPath: cp }).lean()) ??
    (cp
      ? await RoadmapTemplate.findOne({ careerPath: { $regex: `^${cp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).lean()
      : null);
  if (existing?.weeks?.length) {
    return { weeks: existing.weeks as any, provider: (existing.provider as any) ?? "deterministic" };
  }

  const staticWeeks = staticTemplateForCareerPath(cp);
  const provider: "deterministic" | "csv" = "deterministic";
  const weeks = staticWeeks ?? (await buildDeterministicRoadmap({
    careerPath: cp,
    requirements: {
      careerPath: cp,
      generatedFrom: staticWeeks ? "static" : "dataset",
      skills: { technical: [], aptitude: [], dsa: [], softSkills: [] },
    },
  }));

  await RoadmapTemplate.create({
    careerPath: cp,
    provider,
    generatedAt: new Date(),
    version: 1,
    weeks,
  });

  return { weeks, provider };
}
