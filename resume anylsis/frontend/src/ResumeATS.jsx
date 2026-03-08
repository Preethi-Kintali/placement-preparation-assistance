import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function SkillPill({ label, tone = "sky" }) {
  const palette = {
    sky: "bg-sky-100 text-sky-800 border-sky-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${palette[tone]}`}
    >
      {label}
    </span>
  );
}

function ResultCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ResumeATS() {
  const [resumePdf, setResumePdf] = useState(null);
  const [jobDescriptionPdf, setJobDescriptionPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!resumePdf) {
      setError("Resume PDF is required.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const payload = new FormData();
    payload.append("resumePdf", resumePdf);

    if (jobDescriptionPdf) {
      payload.append("jobDescriptionPdf", jobDescriptionPdf);
    }

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: payload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze resume.");
      }

      setResult(data);
    } catch (requestError) {
      setError(requestError.message || "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Resume ATS Analyzer
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Upload your resume PDF and optionally a job description PDF for ATS scoring.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-slate-700">Resume PDF (required)</span>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-sky-700"
              onChange={(event) => setResumePdf(event.target.files?.[0] || null)}
            />
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-slate-700">
              Job Description PDF (optional)
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-600"
              onChange={(event) => setJobDescriptionPdf(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Analyze Resume"}
        </button>

        {error && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}
      </div>

      {result && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ResultCard title="ATS Score">
            <p className="text-4xl font-extrabold text-ink">{result.atsScore}%</p>
          </ResultCard>

          <ResultCard title="Semantic Similarity">
            <p className="text-4xl font-extrabold text-accent">
              {result.semanticSimilarity || 0}%
            </p>
          </ResultCard>

          <ResultCard title="Matched Skills">
            <div className="flex flex-wrap gap-2">
              {result.matchedSkills?.length ? (
                result.matchedSkills.map((skill) => (
                  <SkillPill key={skill} label={skill} tone="emerald" />
                ))
              ) : (
                <p className="text-sm text-slate-500">No matched skills found.</p>
              )}
            </div>
          </ResultCard>

          <ResultCard title="Missing Skills">
            <div className="flex flex-wrap gap-2">
              {result.missingSkills?.length ? (
                result.missingSkills.map((skill) => (
                  <SkillPill key={skill} label={skill} tone="rose" />
                ))
              ) : (
                <p className="text-sm text-slate-500">No missing skills.</p>
              )}
            </div>
          </ResultCard>

          <ResultCard title="Extra Skills">
            <div className="flex flex-wrap gap-2">
              {result.extraSkills?.length ? (
                result.extraSkills.map((skill) => <SkillPill key={skill} label={skill} tone="sky" />)
              ) : (
                <p className="text-sm text-slate-500">No extra skills found.</p>
              )}
            </div>
          </ResultCard>

          <ResultCard title="Model Recommendations">
            <ul className="space-y-2 text-sm text-slate-700">
              {result.modelRecommendations?.map((item) => (
                <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </ResultCard>

          <ResultCard title="Gemini Recommendations">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source: {result.recommendationSource || "rule-based"}
            </p>
            <p className="mb-3 text-xs text-slate-500">{result.geminiStatus || "No status"}</p>
            {result.geminiEnabled ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {result.geminiRecommendations?.length ? (
                  result.geminiRecommendations.map((item) => (
                    <li key={item} className="rounded-lg bg-amber-50 px-3 py-2">
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg bg-slate-50 px-3 py-2">
                    Gemini fallback was used, but no extra suggestions were returned.
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Gemini is not enabled. Set GEMINI_API_KEY in backend .env.
              </p>
            )}
          </ResultCard>

          <ResultCard title="ML Model">
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="rounded-lg bg-slate-50 px-3 py-2">
                Vocabulary: {result.modelInfo?.vocabularySize || 0}
              </li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">
                Resume docs: {result.modelInfo?.resumeCount || 0}
              </li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">
                JD docs: {result.modelInfo?.jdCount || 0}
              </li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">
                Trained at: {result.modelInfo?.trainedAt || "N/A"}
              </li>
            </ul>
          </ResultCard>

          <ResultCard title="Projects Score">
            <p className="text-4xl font-extrabold text-ink">
              {result.sectionScores?.projects || 0}%
            </p>
          </ResultCard>

          <ResultCard title="Internship Score">
            <p className="text-4xl font-extrabold text-ink">
              {result.sectionScores?.internship || 0}%
            </p>
          </ResultCard>

          <ResultCard title="Achievements Score">
            <p className="text-4xl font-extrabold text-ink">
              {result.sectionScores?.achievements || 0}%
            </p>
          </ResultCard>

          <ResultCard title="Impact Evidence Score">
            <p className="text-4xl font-extrabold text-ink">
              {result.sectionScores?.quantifiedImpact || 0}%
            </p>
          </ResultCard>
        </section>
      )}
    </main>
  );
}
