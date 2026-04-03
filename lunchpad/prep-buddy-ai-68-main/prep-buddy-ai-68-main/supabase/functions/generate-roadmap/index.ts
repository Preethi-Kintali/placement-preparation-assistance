import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { evaluations, company, resumeData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const weakAreas = evaluations
      .filter((e: any) => e.score < 7)
      .map((e: any) => `Q: ${e.question} (Score: ${e.score}/10) - ${e.improvement}`)
      .join("\n");

    const avgScore = evaluations.reduce((s: number, e: any) => s + e.score, 0) / evaluations.length;

    const prompt = `Based on:
- Candidate skills: ${resumeData.skills.join(", ")}
- Target company: ${company}
- Average score: ${avgScore.toFixed(1)}/10
- Weak areas:
${weakAreas || "No major weaknesses identified"}

Generate a detailed 2-week preparation roadmap. Include:
- Topics to study each day
- Daily plan with time estimates
- Practice resources (websites, platforms)
- Mock interview suggestions
- Specific areas to focus on based on weaknesses

Format as a clear, actionable markdown plan with headers for each week and day.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert career coach specializing in tech interview preparation. Create detailed, actionable roadmaps." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate roadmap");
    }

    const aiData = await response.json();
    const roadmap = aiData.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ roadmap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-roadmap error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
