import { env } from "../config/env";
import { fetchJson } from "./http";

export type YoutubeVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
  thumbnailUrl?: string;
};

export type YoutubeSearchSource = "rapidapi" | "youtube-data-v3";

type YoutubeSearchResponse = {
  items: Array<{
    id: { videoId?: string };
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails?: { high?: { url?: string }; default?: { url?: string } };
    };
  }>;
};

function trimOrEmpty(v: unknown): string {
  return String(v ?? "").trim();
}

function unwrapQuoted(v: string): string {
  const s = String(v ?? "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function hasRapidApiConfig() {
  const key = unwrapQuoted(trimOrEmpty(env.RAPIDAPI_KEY));
  const host = unwrapQuoted(trimOrEmpty(env.RAPIDAPI_HOST));
  const url = unwrapQuoted(trimOrEmpty(env.RAPIDAPI_URL));
  return Boolean(key && host && url);
}

function pickFirstArray(obj: any): any[] {
  const candidates = [
    obj?.items,
    obj?.results,
    obj?.videos,
    obj?.data?.items,
    obj?.data?.videos,
  ].filter(Boolean);

  const arr = candidates.find((x) => Array.isArray(x));
  return Array.isArray(arr) ? arr : [];
}

function toYoutubeVideoFromRapid(item: any): YoutubeVideo | null {
  const videoId =
    item?.video_id ??
    item?.videoId ??
    item?.id?.videoId ??
    item?.id?.video_id ??
    item?.id;

  const vid = trimOrEmpty(videoId);
  if (!vid) return null;

  const title =
    trimOrEmpty(item?.title) ||
    trimOrEmpty(item?.snippet?.title) ||
    trimOrEmpty(item?.video_title) ||
    trimOrEmpty(item?.name) ||
    vid;

  const channelTitle =
    trimOrEmpty(item?.channelTitle) ||
    trimOrEmpty(item?.channel_title) ||
    trimOrEmpty(item?.channel?.name) ||
    trimOrEmpty(item?.author) ||
    trimOrEmpty(item?.snippet?.channelTitle) ||
    "YouTube";

  const thumb =
    trimOrEmpty(item?.thumbnail) ||
    trimOrEmpty(item?.thumbnailUrl) ||
    trimOrEmpty(item?.thumbnails?.[0]?.url) ||
    trimOrEmpty(item?.snippet?.thumbnails?.high?.url) ||
    trimOrEmpty(item?.snippet?.thumbnails?.default?.url);

  return {
    videoId: vid,
    title,
    channelTitle,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`,
    thumbnailUrl: thumb || undefined,
  };
}

async function rapidApiYoutubeSearch(query: string, maxResults: number): Promise<YoutubeVideo[]> {
  const key = unwrapQuoted(trimOrEmpty(env.RAPIDAPI_KEY));
  const host = unwrapQuoted(trimOrEmpty(env.RAPIDAPI_HOST));
  const baseUrl = unwrapQuoted(trimOrEmpty(env.RAPIDAPI_URL));

  if (!key || !host || !baseUrl) {
    throw new Error("RapidAPI not configured");
  }

  const url = new URL(baseUrl);
  // RapidAPI YouTube v2 commonly uses `query`; keep `q` as a backup.
  url.searchParams.set("query", query);
  url.searchParams.set("q", query);

  const data = await fetchJson<any>(url, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": host,
      accept: "application/json",
    },
  });

  const items = pickFirstArray(data);
  const videos = items
    .map(toYoutubeVideoFromRapid)
    .filter(Boolean) as YoutubeVideo[];

  return videos.slice(0, Math.max(1, Math.min(10, maxResults)));
}

async function youtubeDataApiSearch(query: string, maxResults: number): Promise<YoutubeVideo[]> {
  if (!env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("key", env.YOUTUBE_API_KEY);

  const data = await fetchJson<YoutubeSearchResponse>(url);

  return (data.items || [])
    .map((it) => {
      const videoId = it.id.videoId;
      if (!videoId) return null;
      const thumb = it.snippet.thumbnails?.high?.url ?? it.snippet.thumbnails?.default?.url;
      return {
        videoId,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: thumb,
      } satisfies YoutubeVideo;
    })
    .filter(Boolean) as YoutubeVideo[];
}

export async function youtubeSearch(query: string, maxResults: number): Promise<{ videos: YoutubeVideo[]; source: YoutubeSearchSource }> {
  if (hasRapidApiConfig()) {
    const videos = await rapidApiYoutubeSearch(query, maxResults);
    return { videos, source: "rapidapi" };
  }

  const videos = await youtubeDataApiSearch(query, maxResults);
  return { videos, source: "youtube-data-v3" };
}
