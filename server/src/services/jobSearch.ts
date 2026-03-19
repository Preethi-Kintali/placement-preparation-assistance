import axios from "axios";
import { env } from "../config/env";

function buildRapidApiHeaders(host: string) {
    return {
        "x-rapidapi-key": env.RAPIDAPI_KEY || "",
        "x-rapidapi-host": host,
        "Content-Type": "application/json",
    };
}

export interface JobResult {
    title: string;
    company: string;
    location: string;
    applyLink: string;
    posted: string;
}

/**
 * Fetch role suggestions from Naukri via RapidAPI, then merge with fallback roles.
 */
export async function fetchRoleSuggestions(queryText: string): Promise<string[]> {
    const baseUrl = env.NAUKRI_BASE_URL;
    const host = env.NAUKRI_HOST;
    const path = env.NAUKRI_DISCOVERY_PATH || "/naukri/discovery/roles";

    let naukriRoles: string[] = [];

    if (baseUrl && host && env.RAPIDAPI_KEY) {
        try {
            const response = await axios.get(`${baseUrl}${path}`, {
                headers: buildRapidApiHeaders(host),
                timeout: 15000,
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
                .map((item: any) => {
                    if (typeof item === "string") return item;
                    return item?.role || item?.title || item?.name || "";
                })
                .filter(Boolean) as string[];

            const q = queryText.toLowerCase();
            const filtered = normalized.filter((r) => r.toLowerCase().includes(q));
            const merged = filtered.length ? filtered : normalized;
            naukriRoles = Array.from(new Set(merged)).slice(0, 20);
        } catch {
            // silently fall back
        }
    }

    const fallback = [
        `${queryText} developer`,
        `${queryText} engineer`,
        `${queryText} lead`,
        `${queryText} architect`,
        `${queryText} intern`,
    ];

    return Array.from(new Set([...naukriRoles, ...fallback])).slice(0, 20);
}

/**
 * Fetch live job listings from JSearch (RapidAPI).
 */
export async function fetchJobs(role: string): Promise<JobResult[]> {
    if (!env.RAPIDAPI_KEY) {
        console.error("[JobSearch] RAPIDAPI_KEY is missing!");
        return [];
    }

    const baseUrl = env.JSEARCH_BASE_URL || "https://jsearch.p.rapidapi.com";
    const host = env.JSEARCH_HOST || "jsearch.p.rapidapi.com";
    const searchPath = env.JSEARCH_SEARCH_PATH || "/search";
    const pages = env.JSEARCH_PAGES || 1;

    console.log(`[JobSearch] Fetching jobs for "${role}" from ${baseUrl}${searchPath}`);

    try {
        const response = await axios.get(`${baseUrl}${searchPath}`, {
            params: {
                query: `${role} jobs in india`,
                page: 1,
                num_pages: pages,
                country: "in",
                date_posted: "all",
            },
            headers: buildRapidApiHeaders(host),
            timeout: 20000,
        });

        const list = Array.isArray(response?.data?.data) ? response.data.data : [];
        console.log(`[JobSearch] Got ${list.length} results for "${role}"`);

        return list.slice(0, 10).map((job: any): JobResult => ({
            title: job.job_title || "N/A",
            company: job.employer_name || "N/A",
            location:
                job.job_location || job.job_city || job.job_state || job.job_country || "N/A",
            applyLink: job.job_apply_link || job.job_google_link || "",
            posted: job.job_posted_at_datetime_utc || job.job_posted_human_readable || "",
        }));
    } catch (err: any) {
        console.error("[JobSearch] API Error:", err?.response?.status, err?.response?.data || err.message);
        throw err;
    }
}
