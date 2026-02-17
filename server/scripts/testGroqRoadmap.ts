import "dotenv/config";
import { groqRequirements, groqRoadmap } from "../src/services/groq";
import { buildDeterministicRoadmap } from "../src/services/deterministicRoadmap";

function countBy<T extends string>(arr: T[]) {
  const m = new Map<T, number>();
  for (const a of arr) m.set(a, (m.get(a) ?? 0) + 1);
  return Object.fromEntries(Array.from(m.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

async function main() {
  const careerPath = process.argv[2] ?? "Full Stack Developer";

  const req = await groqRequirements(careerPath);
  console.log("requirements.skills lengths:", {
    technical: Array.isArray((req as any)?.skills?.technical) ? (req as any).skills.technical.length : 0,
    aptitude: Array.isArray((req as any)?.skills?.aptitude) ? (req as any).skills.aptitude.length : 0,
    dsa: Array.isArray((req as any)?.skills?.dsa) ? (req as any).skills.dsa.length : 0,
    softSkills: Array.isArray((req as any)?.skills?.softSkills) ? (req as any).skills.softSkills.length : 0,
  });

  try {
    const plan = await groqRoadmap({ careerPath, requirements: req, learnedTopics: [] });
    const allDays = plan.weeks.flatMap((w) => w.days);
    console.log("groqRoadmap weeks/days:", { weeks: plan.weeks.length, days: allDays.length });
    console.log("groqRoadmap category counts:", countBy(allDays.map((d: any) => d.category)));
    console.log("sample week1:", plan.weeks[0]);
  } catch (e: any) {
    console.error("groqRoadmap failed:", e?.message ?? e);
  }

  const det = buildDeterministicRoadmap({ careerPath, requirements: req as any });
  const detDays = det.flatMap((w) => w.days);
  console.log("deterministic weeks/days:", { weeks: det.length, days: detDays.length });
  console.log("deterministic category counts:", countBy(detDays.map((d) => d.category)));
  console.log("sample det week1:", det[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
