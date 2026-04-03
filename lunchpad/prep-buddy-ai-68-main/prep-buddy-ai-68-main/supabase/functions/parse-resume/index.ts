import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    const { data: fileData, error } = await supabase.storage
      .from("resumes")
      .download(fileName);
    if (error) throw error;

    const text = await fileData.text();

    // Use AI to extract structured data from resume text
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a resume parser. Extract structured data from the resume text. Return ONLY valid JSON with this exact structure:
{"name": "string", "skills": ["string"], "projects": ["string"], "experience": ["string"], "education": ["string"]}
Each array should contain descriptive strings. If a section is not found, use an empty array. For name, extract the candidate's name or use "Unknown" if not found.`,
          },
          { role: "user", content: `Parse this resume:\n\n${text}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_resume",
            description: "Extract structured resume data",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                skills: { type: "array", items: { type: "string" } },
                projects: { type: "array", items: { type: "string" } },
                experience: { type: "array", items: { type: "string" } },
                education: { type: "array", items: { type: "string" } },
              },
              required: ["name", "skills", "projects", "experience", "education"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_resume" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Failed to parse resume with AI");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-resume error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
