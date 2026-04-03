import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { resumeData, company, difficulty } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const prompt = `You are an interviewer at ${company}.

Candidate Profile:
Skills: ${resumeData.skills.join(", ")}
Projects: ${resumeData.projects.join("; ")}
Experience: ${resumeData.experience.join("; ")}
Education: ${resumeData.education.join("; ")}

Generate interview questions at ${difficulty} difficulty level:
- 3 Technical Questions
- 2 Project-Based Questions
- 2 Behavioral Questions

Rules:
- Questions must be specific to the candidate's profile
- Avoid generic questions
- Match ${company}'s hiring style
- Adjust difficulty based on experience level`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert technical interviewer." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_questions",
            description: "Generate structured interview questions",
            parameters: {
              type: "object",
              properties: {
                technical: { type: "array", items: { type: "string" }, description: "3 technical questions" },
                project: { type: "array", items: { type: "string" }, description: "2 project-based questions" },
                behavioral: { type: "array", items: { type: "string" }, description: "2 behavioral questions" },
              },
              required: ["technical", "project", "behavioral"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_questions" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate questions");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
