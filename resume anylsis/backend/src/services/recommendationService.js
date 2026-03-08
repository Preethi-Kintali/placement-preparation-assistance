function buildBaseRecommendations({
  missingSkills,
  semanticSimilarity,
  tokenCount,
  hasSkillsSection,
  sectionScores,
  matchedSkills,
  extraSkills,
  hasJobDescription,
}) {
  const recommendations = [];

  if (missingSkills.length) {
    recommendations.push(
      `Add the following skills to your resume: ${missingSkills.join(", ")}`
    );
  }

  if (semanticSimilarity !== null && semanticSimilarity < 60) {
    recommendations.push(
      "Your resume content does not closely match the job description."
    );
  }

  if (tokenCount < 140) {
    recommendations.push(
      "Add more project details and measurable achievements."
    );
  }

  if (!hasSkillsSection) {
    recommendations.push("Add a clear technical skills section.");
  }

  if ((sectionScores?.projects || 0) < 55) {
    recommendations.push("Strengthen your projects section with 2-3 detailed technical projects.");
  }

  if ((sectionScores?.internship || 0) < 45) {
    recommendations.push("Include internships or practical training with tech stack and outcomes.");
  }

  if ((sectionScores?.achievements || 0) < 45) {
    recommendations.push("Add achievements with quantified impact such as percentages or metrics.");
  }

  if (matchedSkills?.length) {
    recommendations.push(
      `Move matched skills (${matchedSkills.slice(0, 6).join(", ")}) closer to the top summary for stronger ATS visibility.`
    );
  }

  if (extraSkills?.length && hasJobDescription) {
    recommendations.push(
      `Prioritize JD-relevant skills before less relevant ones like ${extraSkills
        .slice(0, 4)
        .join(", ")}.`
    );
  }

  if (!recommendations.length) {
    recommendations.push("Resume is well aligned. Keep tailoring for each role.");
  }

  return [...new Set(recommendations)].slice(0, 6);
}

function parseGeminiRecommendations(text = "") {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function extractJsonObject(text = "") {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }

  return text;
}

function ensureMinimumRecommendations(list = [], context = {}) {
  const seeded = [...list];
  const fillers = [];

  if (context.missingSkills?.length) {
    fillers.push(
      `Add missing skills first: ${context.missingSkills.slice(0, 5).join(", ")}.`
    );
  }

  if ((context.sectionScores?.projects || 0) < 60) {
    fillers.push("Add 2 project bullets with stack, impact, and measurable results.");
  }

  if ((context.sectionScores?.achievements || 0) < 60) {
    fillers.push("Include one quantified achievement with a clear percentage or metric.");
  }

  if (!context.hasSkillsSection) {
    fillers.push("Create a dedicated skills section near the top of your resume.");
  }

  fillers.push("Tailor summary and experience bullets using exact JD keywords.");
  fillers.push("Start bullets with action verbs and keep each line outcome-focused.");

  for (const item of fillers) {
    if (seeded.length >= 4) {
      break;
    }

    if (!seeded.includes(item)) {
      seeded.push(item);
    }
  }

  return seeded.slice(0, 4);
}

async function fetchGeminiRecommendations(context, baseRecommendations) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      modelRecommendations: baseRecommendations,
      geminiRecommendations: [],
      geminiSource: "disabled",
      geminiEnabled: false,
      geminiStatus: "No GEMINI_API_KEY configured",
    };
  }

  const lowSections = Object.entries(context.sectionScores || {})
    .filter(([, score]) => Number(score) < 60)
    .map(([section]) => section);

  const prompt = [
    "You are an ATS resume coach.",
    "Generate personalized recommendations for this specific resume.",
    "Return STRICT JSON in this format only: {\"recommendations\":[\"...\",\"...\",\"...\",\"...\"]}",
    "Rules:",
    "- Exactly 4 recommendations.",
    "- Each recommendation must reference at least one concrete signal from input.",
    "- Do not repeat generic advice unless tied to a provided signal.",
    "- Keep each recommendation under 120 characters.",
    `Has JD: ${context.hasJobDescription}`,
    `Missing skills: ${context.missingSkills.join(", ") || "none"}`,
    `Matched skills: ${context.matchedSkills.join(", ") || "none"}`,
    `Extra skills: ${context.extraSkills.join(", ") || "none"}`,
    `Semantic similarity: ${context.semanticSimilarity ?? "N/A"}`,
    `Token count: ${context.tokenCount}`,
    `Has skills section: ${context.hasSkillsSection}`,
    `Section scores: ${JSON.stringify(context.sectionScores || {})}`,
    `Low sections: ${lowSections.join(", ") || "none"}`,
  ].join("\n");

  const modelCandidates = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
  ];

  let lastError = "Unknown Gemini error";

  for (const modelName of modelCandidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const body = await response.text();
        lastError = `${modelName} failed (${response.status}): ${body.slice(0, 180)}`;
        continue;
      }

      const payload = await response.json();
      const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let parsed = [];
      try {
        const parsedJson = JSON.parse(extractJsonObject(rawText));
        if (Array.isArray(parsedJson?.recommendations)) {
          parsed = parsedJson.recommendations
            .map((item) => String(item || "").trim())
            .filter(Boolean);
        }
      } catch (_error) {
        parsed = parseGeminiRecommendations(rawText);
      }

      parsed = ensureMinimumRecommendations([...new Set(parsed)], context);
      if (!parsed.length) {
        lastError = `${modelName} returned empty recommendation text`;
        continue;
      }

      return {
        modelRecommendations: baseRecommendations,
        geminiRecommendations: parsed,
        geminiSource: "gemini",
        geminiEnabled: true,
        geminiStatus: `Gemini success via ${modelName}`,
      };
    } catch (error) {
      lastError = `${modelName} exception: ${error.message}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    modelRecommendations: baseRecommendations,
    geminiRecommendations: [],
    geminiSource: "rule-based-fallback",
    geminiEnabled: true,
    geminiStatus: lastError,
  };
}

async function buildRecommendations(context) {
  const modelRecommendations = ensureMinimumRecommendations(
    buildBaseRecommendations(context),
    context
  );
  return fetchGeminiRecommendations(context, modelRecommendations);
}

module.exports = {
  buildRecommendations,
};
