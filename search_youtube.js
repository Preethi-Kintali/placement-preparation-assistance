// Simple Node.js script to get the best YouTube link for a topic
// using the RapidAPI "YouTube v2" API.
//
// IMPORTANT:
// 1. Do NOT hard-code your real API key in this file.
// 2. Set these environment variables instead before running:
//    RAPIDAPI_KEY  - your RapidAPI key
//    RAPIDAPI_HOST - the X-RapidAPI-Host value shown in the YouTube v2 docs
//    RAPIDAPI_URL  - the full search endpoint URL from the YouTube v2 docs
//                    (for example, the base URL that accepts a `q` or `query` parameter)
//
// Example run (in PowerShell):
//   $env:RAPIDAPI_KEY="<your-key>"
//   $env:RAPIDAPI_HOST="<your-host-from-docs>"
//   $env:RAPIDAPI_URL="<your-search-url-from-docs>"
//   node search_youtube.js "array"

import https from 'node:https';

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildSearchUrl(topic) {
  const baseUrl = getEnv('RAPIDAPI_URL');

  // Append the topic as a query parameter.
  // For RapidAPI "YouTube v2", the parameter is typically named `query`.
  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set('query', topic);
  return urlObj.toString();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'X-RapidAPI-Key': getEnv('RAPIDAPI_KEY'),
        'X-RapidAPI-Host': getEnv('RAPIDAPI_HOST'),
      },
    };

    https
      .get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            reject(new Error('Failed to parse JSON from API: ' + err.message));
          }
        });
      })
      .on('error', (err) => reject(err));
  });
}

function pickBestVideoUrl(apiResponse) {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Unexpected API response format.');
  }

  const candidates = [
    apiResponse.items,
    apiResponse.results,
    apiResponse.videos,
    apiResponse.data && apiResponse.data.items,
    apiResponse.data && apiResponse.data.videos,
  ].filter(Boolean);

  const items = candidates.find(Array.isArray);

  if (!items || items.length === 0) {
    throw new Error('No videos found for this topic.');
  }

  const first = items[0];

  // YouTube v2 exposes a `video_id`; build a standard watch URL.
  if (first && typeof first.video_id === 'string') {
    return `https://www.youtube.com/watch?v=${first.video_id}`;
  }

  if (first && typeof first.videoId === 'string') {
    return `https://www.youtube.com/watch?v=${first.videoId}`;
  }

  const possibleUrlFields = ['url', 'link', 'video_url', 'videoUrl'];
  for (const field of possibleUrlFields) {
    if (first && typeof first[field] === 'string') {
      return first[field];
    }
  }

  throw new Error('Could not determine video URL from API response.');
}

async function getBestYoutubeLink(topic) {
  const url = buildSearchUrl(topic);
  const json = await fetchJson(url);
  const bestUrl = pickBestVideoUrl(json);
  return bestUrl;
}

async function main() {
  const topic = process.argv.slice(2).join(' ').trim();
  if (!topic) {
    console.error('Usage: node search_youtube.js "topic here"');
    process.exit(1);
  }

  try {
    const bestLink = await getBestYoutubeLink(topic);
    console.log(bestLink);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
