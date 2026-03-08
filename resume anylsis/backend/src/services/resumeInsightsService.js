function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function keywordDensityScore(text, keywords, maxCount = 8) {
  const count = keywords.reduce((acc, keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "g");
    return acc + countMatches(text, regex);
  }, 0);

  return clampScore((Math.min(count, maxCount) / maxCount) * 100);
}

function detectSection(text, sectionAliases) {
  return containsAny(text, sectionAliases) ? 100 : 0;
}

function impactScore(rawText) {
  const normalized = rawText.toLowerCase();
  const numericMentions = countMatches(normalized, /\b\d+(\.\d+)?%?\b/g);
  const impactWords = [
    "increased",
    "reduced",
    "improved",
    "optimized",
    "saved",
    "scaled",
    "boosted",
    "growth",
    "kpi",
    "revenue",
  ];

  const impactKeywordHits = impactWords.reduce((acc, word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    return acc + countMatches(normalized, regex);
  }, 0);

  const numericPart = Math.min(50, numericMentions * 8);
  const keywordPart = Math.min(50, impactKeywordHits * 6);
  return clampScore(numericPart + keywordPart);
}

function analyzeResumeInsights({ normalizedText = "", rawText = "" }) {
  const projectsKeywords = [
    "project",
    "projects",
    "developed",
    "built",
    "implemented",
    "deployed",
    "designed",
    "architecture",
  ];

  const internshipKeywords = [
    "intern",
    "internship",
    "trainee",
    "apprentice",
    "summer intern",
    "industrial training",
  ];

  const achievementKeywords = [
    "achievement",
    "awarded",
    "award",
    "recognition",
    "rank",
    "winner",
    "published",
    "patent",
    "certified",
    "certification",
  ];

  const projectsSection = detectSection(normalizedText, ["projects", "project"]);
  const internshipSection = detectSection(normalizedText, [
    "internship",
    "intern",
    "trainee",
  ]);
  const achievementsSection = detectSection(normalizedText, [
    "achievements",
    "achievement",
    "awards",
  ]);

  const projectsDensity = keywordDensityScore(normalizedText, projectsKeywords, 10);
  const internshipDensity = keywordDensityScore(normalizedText, internshipKeywords, 5);
  const achievementsDensity = keywordDensityScore(normalizedText, achievementKeywords, 6);
  const quantifiedImpactScore = impactScore(rawText);

  const projectsScore = clampScore(0.55 * projectsSection + 0.45 * projectsDensity);
  const internshipScore = clampScore(0.6 * internshipSection + 0.4 * internshipDensity);
  const achievementsScore = clampScore(
    0.55 * achievementsSection + 0.25 * achievementsDensity + 0.2 * quantifiedImpactScore
  );

  const qualityComposite = clampScore(
    0.4 * projectsScore +
      0.25 * internshipScore +
      0.2 * achievementsScore +
      0.15 * quantifiedImpactScore
  );

  return {
    sectionScores: {
      projects: projectsScore,
      internship: internshipScore,
      achievements: achievementsScore,
      quantifiedImpact: quantifiedImpactScore,
    },
    qualityComposite,
  };
}

module.exports = {
  analyzeResumeInsights,
};
