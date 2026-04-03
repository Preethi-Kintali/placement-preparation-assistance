import mongoose, { Schema } from "mongoose";

export type AlertType =
    | "roadmap_behind"
    | "weak_subject"
    | "placement_drop"
    | "streak_broken"
    | "achievement"
    | "skill_gap"
    | "exam_reminder";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertDoc {
    _id: mongoose.Types.ObjectId;
    userId: string;
    type: AlertType;
    title: string;
    message: string;
    severity: AlertSeverity;
    read: boolean;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const alertSchema = new Schema<AlertDoc>(
    {
        userId: { type: String, required: true, index: true },
        type: {
            type: String,
            enum: [
                "roadmap_behind",
                "weak_subject",
                "placement_drop",
                "streak_broken",
                "achievement",
                "skill_gap",
                "exam_reminder",
            ],
            required: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        severity: {
            type: String,
            enum: ["info", "warning", "critical"],
            default: "info",
        },
        read: { type: Boolean, default: false },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

alertSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Alert = mongoose.model<AlertDoc>("Alert", alertSchema);
