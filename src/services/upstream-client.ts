import { DEFAULT_UPSTREAM_URL, getBrowserHeaders } from '../config.js';
import type { UpstreamPayload } from '../types.js';

export class UpstreamError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;

  constructor(message: string, statusCode: number = 502, retryAfter?: number) {
    super(message);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfter;
  }
}

export async function sendNonStreamingRequest(
  payload: UpstreamPayload,
  upstreamUrl: string = DEFAULT_UPSTREAM_URL,
  signal?: AbortSignal
): Promise<string> {
  const headers = getBrowserHeaders();

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new UpstreamError(`Failed to connect to upstream service: ${msg}`, 502);
  }

  if (!response.ok) {
    await handleUpstreamErrorResponse(response);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as Record<string, unknown>;
    if (typeof data.content === 'string') {
      return data.content;
    }
    if (
      Array.isArray(data.choices) &&
      data.choices.length > 0 &&
      data.choices[0]?.message?.content
    ) {
      return data.choices[0].message.content as string;
    }
    return JSON.stringify(data);
  }

  return await response.text();
}

export async function sendStreamingRequest(
  payload: UpstreamPayload,
  upstreamUrl: string = DEFAULT_UPSTREAM_URL,
  signal?: AbortSignal
): Promise<Response> {
  const headers = getBrowserHeaders();

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new UpstreamError(`Failed to connect to upstream service: ${msg}`, 502);
  }

  if (!response.ok) {
    await handleUpstreamErrorResponse(response);
  }

  return response;
}

async function handleUpstreamErrorResponse(response: Response): Promise<never> {
  let errorMsg = `Upstream error HTTP ${response.status}`;
  let retrySeconds: number | undefined;

  try {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (typeof data.error === 'string') {
        errorMsg = data.error;
        const retryMatch = data.error.match(/Retry in (\d+)s/i);
        if (retryMatch) {
          retrySeconds = parseInt(retryMatch[1], 10);
        }
      }
    } catch {
      if (text) {
        errorMsg = text.slice(0, 300);
      }
    }
  } catch {
    // Ignore body reading error
  }

  throw new UpstreamError(errorMsg, response.status, retrySeconds);
}
