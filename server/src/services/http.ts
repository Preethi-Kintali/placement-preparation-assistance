export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string
  ) {
    super(message ?? `HTTP ${status}`);
  }
}

export async function fetchJson<T>(input: string | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep as text
  }

  if (!res.ok) {
    throw new HttpError(res.status, body);
  }

  return body as T;
}
