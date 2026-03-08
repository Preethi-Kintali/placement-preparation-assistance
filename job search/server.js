const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function cleanRole(role) {
  return (role || "").trim().replace(/\s+/g, " ");
}

function buildRapidApiHeaders(host) {
  return {
    "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    "x-rapidapi-host": host,
    "Content-Type": "application/json"
  };
}

async function fetchNaukriRoles(queryText) {
  const baseUrl = process.env.NAUKRI_BASE_URL;
  const host = process.env.NAUKRI_HOST;
  const path = process.env.NAUKRI_DISCOVERY_PATH || "/naukri/discovery/roles";

  if (!baseUrl || !host || !process.env.RAPIDAPI_KEY) {
    return [];
  }

  try {
    const response = await axios.get(`${baseUrl}${path}`, {
      headers: buildRapidApiHeaders(host),
      timeout: 15000
    });

    const raw = response?.data;
    const candidates = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.roles)
      ? raw.roles
      : [];

    const normalized = candidates
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.role || item?.title || item?.name || "";
      })
      .filter(Boolean);

    const q = queryText.toLowerCase();
    const filtered = normalized.filter((r) => r.toLowerCase().includes(q));
    const merged = filtered.length ? filtered : normalized;

    return Array.from(new Set(merged)).slice(0, 20);
  } catch (_err) {
    return [];
  }
}

async function fetchJSearchJobs(role) {
  const baseUrl = process.env.JSEARCH_BASE_URL || "https://jsearch.p.rapidapi.com";
  const host = process.env.JSEARCH_HOST || "jsearch.p.rapidapi.com";
  const searchPath = process.env.JSEARCH_SEARCH_PATH || "/search";
  const pages = Number(process.env.JSEARCH_PAGES || 1);

  const response = await axios.get(`${baseUrl}${searchPath}`, {
    params: {
      query: `${role} jobs in india`,
      page: 1,
      num_pages: pages,
      country: "in",
      date_posted: "all"
    },
    headers: buildRapidApiHeaders(host),
    timeout: 20000
  });

  const list = Array.isArray(response?.data?.data) ? response.data.data : [];

  return list.slice(0, 10).map((job) => ({
    title: job.job_title || "N/A",
    company: job.employer_name || "N/A",
    location: job.job_location || job.job_city || job.job_state || job.job_country || "N/A",
    applyLink: job.job_apply_link || job.job_google_link || "",
    posted: job.job_posted_at_datetime_utc || job.job_posted_human_readable || ""
  }));
}


app.get("/api/roles", async (req, res) => {
  if (!process.env.RAPIDAPI_KEY) {
    return res.status(500).json({ error: "RAPIDAPI_KEY is missing in .env" });
  }

  const q = cleanRole(req.query.q || "");
  if (!q) {
    return res.status(400).json({ error: "Query q is required" });
  }

  try {
    const naukriRoles = await fetchNaukriRoles(q);

    const fallback = [
      `${q} developer`,
      `${q} engineer`,
      `${q} lead`,
      `${q} architect`,
      `${q} intern`
    ];

    const roles = Array.from(new Set([...naukriRoles, ...fallback])).slice(0, 20);

    return res.json({
      query: q,
      roles
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch roles",
      details: error.message
    });
  }
});

app.get("/api/jobs", async (req, res) => {
  if (!process.env.RAPIDAPI_KEY) {
    return res.status(500).json({ error: "RAPIDAPI_KEY is missing in .env" });
  }

  const role = cleanRole(req.query.role || process.env.JSEARCH_QUERY_DEFAULT || "full stack developer");
  if (!role) {
    return res.status(400).json({ error: "role is required" });
  }

  try {
    const jobs = await fetchJSearchJobs(role);
    return res.json({ role, count: jobs.length, jobs, source: "rapidapi" });
  } catch (error) {
    return res.status(502).json({
      error: "Live jobs provider failed",
      role,
      details: error.message
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "job-search-module" });
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
