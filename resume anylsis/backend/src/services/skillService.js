const technicalSkills = require("../config/skills");

function extractSkills(text = "") {
  const textSet = new Set(text.split(/\s+/).filter(Boolean));
  return technicalSkills.filter((skill) => textSet.has(skill));
}

function compareSkills(resumeSkills = [], jdSkills = []) {
  const resumeSet = new Set(resumeSkills);
  const jdSet = new Set(jdSkills);

  const matchedSkills = [...jdSet].filter((skill) => resumeSet.has(skill));
  const missingSkills = [...jdSet].filter((skill) => !resumeSet.has(skill));
  const extraSkills = [...resumeSet].filter((skill) => !jdSet.has(skill));

  return {
    matchedSkills,
    missingSkills,
    extraSkills,
  };
}

module.exports = {
  extractSkills,
  compareSkills,
};
