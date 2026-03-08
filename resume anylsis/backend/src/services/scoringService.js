const { loadDatasetKeywords } = require("./datasetService");
const { calculateResumeModelQuality } = require("./mlModelService");

const CORE_SECTIONS = ["skills", "projects", "experience", "education"];

function calculateAtsScoreWithJd({
  matchedSkills,
  jdSkillsCount,
  semanticSimilarity,
  qualityComposite,
}) {
  const safeJdCount = jdSkillsCount > 0 ? jdSkillsCount : 1;
  const skillMatchScore = (matchedSkills.length / safeJdCount) * 100;
  const atsScore =
    0.5 * skillMatchScore + 0.3 * semanticSimilarity + 0.2 * qualityComposite;

  return {
    skillMatchScore: Math.round(skillMatchScore * 100) / 100,
    atsScore: Math.round(atsScore * 100) / 100,
  };
}

function getSectionCoverageScore(normalizedText) {
  const sectionHits = CORE_SECTIONS.filter((section) =>
    normalizedText.includes(section)
  ).length;

  return {
    sectionHits,
    sectionCoverageScore: (sectionHits / CORE_SECTIONS.length) * 100,
    hasSkillsSection: normalizedText.includes("skills"),
  };
}

function getLengthScore(tokenCount) {
  if (tokenCount < 120) {
    return 35;
  }

  if (tokenCount < 220) {
    return 60;
  }

  if (tokenCount < 350) {
    return 82;
  }

  return 95;
}

async function getKeywordRichnessScore(filteredTokens = []) {
  const datasetKeywords = await loadDatasetKeywords();
  if (!datasetKeywords.size || !filteredTokens.length) {
    return 50;
  }

  const unique = [...new Set(filteredTokens)];
  const matched = unique.filter((token) => datasetKeywords.has(token)).length;
  const ratio = matched / unique.length;

  return Math.min(100, Math.round(ratio * 150 * 100) / 100);
}

async function calculateResumeOnlyScore({
  normalizedText,
  filteredTokens,
  qualityComposite,
}) {
  const tokenCount = filteredTokens.length;
  const { sectionHits, sectionCoverageScore, hasSkillsSection } =
    getSectionCoverageScore(normalizedText);
  const lengthScore = getLengthScore(tokenCount);
  const keywordRichnessScore = await getKeywordRichnessScore(filteredTokens);
  const modelQualityScore = await calculateResumeModelQuality(
    filteredTokens.join(" ")
  );

  const atsScore =
    0.3 * sectionCoverageScore +
    0.2 * keywordRichnessScore +
    0.2 * lengthScore +
    0.15 * modelQualityScore +
    0.15 * qualityComposite;

  return {
    atsScore: Math.round(atsScore * 100) / 100,
    hasSkillsSection,
    sectionHits,
    tokenCount,
    keywordRichnessScore,
    modelQualityScore,
  };
}

module.exports = {
  calculateAtsScoreWithJd,
  calculateResumeOnlyScore,
};
