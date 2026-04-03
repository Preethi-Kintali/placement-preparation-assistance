import { useState, useCallback } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseResume, createSession } from "@/lib/api";
import type { ResumeData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  onComplete: (data: ResumeData, sessionId: string) => void;
  difficulty: string;
  onDifficultyChange: (d: string) => void;
}

export function ResumeUpload({ onComplete, difficulty, onDifficultyChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "doc", "txt"].includes(ext || "")) {
      toast({ title: "Invalid file", description: "Please upload a PDF, DOCX, or TXT file.", variant: "destructive" });
      return;
    }
    setFile(f);
  }, [toast]);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const sessionId = await createSession(difficulty);
      const data = await parseResume(file);
      onComplete(data, sessionId);
    } catch (e: any) {
      toast({ title: "Error parsing resume", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl gradient-text">Upload Your Resume</CardTitle>
        <CardDescription>Upload your resume to get personalized interview questions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : file ? "border-success bg-success/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input id="file-input" type="file" className="hidden" accept=".pdf,.docx,.doc,.txt" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-12 h-12 text-success" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-12 h-12 text-muted-foreground" />
              <p className="font-medium">Drag & drop your resume here</p>
              <p className="text-sm text-muted-foreground">or click to browse (PDF, DOCX, TXT)</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Difficulty Level</label>
          <Select value={difficulty} onValueChange={onDifficultyChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSubmit} disabled={!file || loading} className="w-full gradient-bg text-primary-foreground hover:opacity-90">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : "Parse Resume & Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
