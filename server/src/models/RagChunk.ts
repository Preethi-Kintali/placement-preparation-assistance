import mongoose, { Schema } from "mongoose";

export interface RagChunkDoc {
    _id: mongoose.Types.ObjectId;
    source: string;          // e.g. "Placement_Assistance_RAG_System.pdf"
    chunkIndex: number;      // sequential chunk number
    text: string;            // the chunk text
    embedding: number[];     // vector embedding (768-dim from Gemini text-embedding-004)
    metadata: {
        page?: number;
        section?: string;
        charStart: number;
        charEnd: number;
    };
    tags?: string[];         // optional topic/domain tags
    createdAt: Date;
    updatedAt: Date;
}

const ragChunkSchema = new Schema<RagChunkDoc>(
    {
        source: { type: String, required: true, index: true },
        chunkIndex: { type: Number, required: true },
        text: { type: String, required: true },
        embedding: { type: [Number], required: true },
        metadata: {
            page: { type: Number },
            section: { type: String },
            charStart: { type: Number, required: true },
            charEnd: { type: Number, required: true },
        },
        tags: { type: [String], default: [] },
    },
    { timestamps: true }
);

ragChunkSchema.index({ source: 1, chunkIndex: 1 }, { unique: true });

export const RagChunk = mongoose.model<RagChunkDoc>("RagChunk", ragChunkSchema);
