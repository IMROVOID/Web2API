import { Hono } from 'hono';
import { resolveModelId } from '../config.js';
import { coerceMessages } from '../services/prompt-coercer.js';
import { extractToolCalls } from '../services/json-extractor.js';
import {
  sendNonStreamingRequest,
  sendStreamingRequest,
  UpstreamError,
} from '../services/upstream-client.js';
import { createSSEStream } from '../services/stream-transformer.js';
import type {
  ChatCompletionChoice,
  ChatCompletionRequest,
  ChatCompletionResponse,
  UpstreamPayload,
} from '../types.js';

export const chatRouter = new Hono();

chatRouter.post('/', async (c) => {
  let body: ChatCompletionRequest;
  try {
    body = await c.req.json<ChatCompletionRequest>();
  } catch {
    return c.json(
      {
        error: {
          message: 'Invalid JSON request body',
          type: 'invalid_request_error',
          code: 'invalid_payload',
        },
      },
      400
    );
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json(
      {
        error: {
          message: '`messages` is required and must be a non-empty array',
          type: 'invalid_request_error',
          code: 'missing_messages',
        },
      },
      400
    );
  }

  const requestedModel = body.model || 'claude-sonnet-5';
  const upstreamModelId = resolveModelId(requestedModel);
  const hasTools = Boolean(body.tools && body.tools.length > 0);
  const isStream = Boolean(body.stream);

  // 1. Coerce messages with tool calling instructions if tools requested
  const coercedMessages = coerceMessages(body.messages, body.tools);

  // 2. Build upstream payload
  const upstreamPayload: UpstreamPayload = {
    messages: coercedMessages,
    modelId: upstreamModelId,
    thinking: false,
    deepSearch: false,
    stream: isStream,
  };

  try {
    // 3. Handle Streaming Request
    if (isStream) {
      const upstreamResp = await sendStreamingRequest(
        upstreamPayload,
        undefined,
        c.req.raw.signal
      );
      const sseStream = createSSEStream(upstreamResp, requestedModel, hasTools);

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // 4. Handle Non-Streaming Request
    const rawContent = await sendNonStreamingRequest(
      upstreamPayload,
      undefined,
      c.req.raw.signal
    );
    const extracted = extractToolCalls(rawContent, hasTools);

    let choice: ChatCompletionChoice;

    if (extracted.isToolCall && extracted.toolCalls.length > 0) {
      choice = {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: extracted.toolCalls,
        },
        finish_reason: 'tool_calls',
      };
    } else {
      choice = {
        index: 0,
        message: {
          role: 'assistant',
          content: extracted.content,
        },
        finish_reason: 'stop',
      };
    }

    const response: ChatCompletionResponse = {
      id: `chatcmpl-${Math.random().toString(36).slice(2, 12)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: requestedModel,
      choices: [choice],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    return c.json(response);
  } catch (err) {
    if (err instanceof UpstreamError) {
      const headers: Record<string, string> = {};
      if (err.retryAfterSeconds) {
        headers['Retry-After'] = String(err.retryAfterSeconds);
      }
      return c.json(
        {
          error: {
            message: err.message,
            type: err.statusCode === 429 ? 'rate_limit_error' : 'upstream_error',
            code: err.statusCode,
          },
        },
        err.statusCode as 429 | 502,
        headers
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        error: {
          message: `Internal proxy error: ${msg}`,
          type: 'api_error',
          code: 500,
        },
      },
      500
    );
  }
});
