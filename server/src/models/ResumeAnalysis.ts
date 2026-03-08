import mongoose, { Schema } from "mongoose";

export interface ResumeAnalysisDoc {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    resumeFileName: string;
    jdFileName: string;
    resumeText: string;
    jdText: string;
    extractedSkills: string[];
    jdSkills: string[];
    matchedSkills: string[];
    missingSkills: string[];
    additionalSkills: string[];
    atsScore: number;
    categoryPrediction: string;
    categoryConfidence: number;
    scoreBreakdown: {
        skillMatch: number;
        categoryRelevance: number;
        keywordDensity: number;
        formatQuality: number;
        experienceMatch: number;
    };
    mlRecommendations: string[];
    geminiRecommendations: string[];
    finalRecommendations: string[];
    createdAt: Date;
    updatedAt: Date;
}

const resumeAnalysisSchema = new Schema<ResumeAnalysisDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        resumeFileName: { type: String, required: true },
        jdFileName: { type: String, default: "" },
        resumeText: { type: String, required: true },
        jdText: { type: String, default: "" },
        extractedSkills: [{ type: String }],
        jdSkills: [{ type: String }],
        matchedSkills: [{ type: String }],
        missingSkills: [{ type: String }],
        additionalSkills: [{ type: String }],
        atsScore: { type: Number, required: true },
        categoryPrediction: { type: String, required: true },
        categoryConfidence: { type: Number, default: 0 },
        scoreBreakdown: {
            skillMatch: { type: Number, default: 0 },
            categoryRelevance: { type: Number, default: 0 },
            keywordDensity: { type: Number, default: 0 },
            formatQuality: { type: Number, default: 0 },
            experienceMatch: { type: Number, default: 0 },
        },
        mlRecommendations: [{ type: String }],
        geminiRecommendations: [{ type: String }],
        finalRecommendations: [{ type: String }],
    },
    { timestamps: true }
);

export const ResumeAnalysis = mongoose.model<ResumeAnalysisDoc>(
    "ResumeAnalysis",
    resumeAnalysisSchema
);
