const { extractPdfText } = require("../services/pdfService");
const { preprocessText } = require("../services/textPreprocessService");
const { extractSkills, compareSkills } = require("../services/skillService");
const { calculateSemanticSimilarity } = require("../services/similarityService");
const {
  calculateAtsScoreWithJd,
  calculateResumeOnlyScore,
} = require("../services/scoringService");
const { buildRecommendations } = require("../services/recommendationService");
const { getModelInfo } = require("../services/mlModelService");
const { analyzeResumeInsights } = require("../services/resumeInsightsService");

async function analyzeResume(req, res, next) {
  try {
    const resumeFile = req.files?.resumePdf?.[0];
    const jdFile = req.files?.jobDescriptionPdf?.[0] || null;

    if (!resumeFile) {
      return res.status(400).json({ error: "Resume PDF is required." });
    }

    const [resumeRawText, jdRawText] = await Promise.all([
      extractPdfText(resumeFile),
      extractPdfText(jdFile),
    ]);

    const resumeProcessed = preprocessText(resumeRawText);
    const jdProcessed = jdRawText ? preprocessText(jdRawText) : null;
    const resumeInsights = analyzeResumeInsights({
      normalizedText: resumeProcessed.normalized,
      rawText: resumeRawText,
    });

    const resumeSkills = extractSkills(resumeProcessed.cleanedText);

    let semanticSimilarity = 0;
    let matchedSkills = [];
    let missingSkills = [];
    let extraSkills = resumeSkills;
    let atsScore = 0;
    let hasSkillsSection = resumeProcessed.normalized.includes("skills");

    if (jdProcessed) {
      const jdSkills = extractSkills(jdProcessed.cleanedText);
      const compared = compareSkills(resumeSkills, jdSkills);
      matchedSkills = compared.matchedSkills;
      missingSkills = compared.missingSkills;
      extraSkills = compared.extraSkills;

      semanticSimilarity = await calculateSemanticSimilarity(
        resumeProcessed.cleanedText,
        jdProcessed.cleanedText
      );

      const scored = calculateAtsScoreWithJd({
        matchedSkills,
        jdSkillsCount: jdSkills.length,
        semanticSimilarity,
        qualityComposite: resumeInsights.qualityComposite,
      });

      atsScore = scored.atsScore;
    } else {
      const scored = await calculateResumeOnlyScore({
        normalizedText: resumeProcessed.normalized,
        filteredTokens: resumeProcessed.filteredTokens,
        qualityComposite: resumeInsights.qualityComposite,
      });

      atsScore = scored.atsScore;
      hasSkillsSection = scored.hasSkillsSection;
    }

    const recommendationResult = await buildRecommendations({
      missingSkills,
      matchedSkills,
      extraSkills,
      semanticSimilarity: jdProcessed ? semanticSimilarity : null,
      tokenCount: resumeProcessed.filteredTokens.length,
      hasSkillsSection,
      sectionScores: resumeInsights.sectionScores,
      hasJobDescription: Boolean(jdProcessed),
    });

    const modelInfo = await getModelInfo();

    return res.json({
      atsScore,
      semanticSimilarity: jdProcessed ? semanticSimilarity : 0,
      matchedSkills,
      missingSkills,
      extraSkills,
      modelRecommendations: recommendationResult.modelRecommendations,
      geminiRecommendations: recommendationResult.geminiRecommendations,
      recommendationSource: recommendationResult.geminiSource,
      geminiEnabled: recommendationResult.geminiEnabled,
      geminiStatus: recommendationResult.geminiStatus,
      modelInfo,
      sectionScores: resumeInsights.sectionScores,
      qualityComposite: resumeInsights.qualityComposite,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  analyzeResume,
};
