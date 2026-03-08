import { Router } from "express";
import { authRouter } from "./auth";
import { examRouter } from "./exams";
import { roadmapRouter } from "./roadmap";
import { adminRouter } from "./admin";
import { aiRouter } from "./ai";
import { metaRouter } from "./meta";
import { predictionRouter } from "./prediction";
import { interviewRouter } from "./interview";
import { activityRouter } from "./activity";
import { jobsRouter } from "./jobs";
import studyAssistantRouter from "./studyAssistant";
import resumeAnalyzerRouter from "./resumeAnalyzer";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/exams", examRouter);
apiRouter.use("/roadmap", roadmapRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/meta", metaRouter);
apiRouter.use("/prediction", predictionRouter);
apiRouter.use("/interview", interviewRouter);
apiRouter.use("/activity", activityRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/study-assistant", studyAssistantRouter);
apiRouter.use("/resume", resumeAnalyzerRouter);
