import { extractToolCalls } from './json-extractor.js';
import type { ChatCompletionChunk } from '../types.js';

export function createSSEStream(
  upstreamResponse: Response,
  requestedModel: string,
  toolsRequested: boolean
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');
  const upstreamBody = upstreamResponse.body;

  if (!upstreamBody) {
    throw new Error('Upstream response body is null');
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = '';
      let accumulatedContent = '';
      let accumulatedReasoning = '';
      const completionId = `chatcmpl-${Math.random().toString(36).slice(2, 12)}`;
      const created = Math.floor(Date.now() / 1000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;

            const dataStr = line.slice(5).trim();
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr) as Record<string, unknown>;
              const choices = parsed.choices as Array<{
                delta?: {
                  content?: string | null;
                  reasoning_content?: string | null;
                };
              }>;

              const delta = choices?.[0]?.delta;
              if (delta?.content) {
                accumulatedContent += delta.content;
              }
              if (delta?.reasoning_content) {
                accumulatedReasoning += delta.reasoning_content;
              }

              // If tools are NOT requested, stream chunks directly in real-time
              if (!toolsRequested) {
                const chunk: ChatCompletionChunk = {
                  id: completionId,
                  object: 'chat.completion.chunk',
                  created,
                  model: requestedModel,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        role: 'assistant',
                        content: delta?.content || null,
                        reasoning_content: delta?.reasoning_content || null,
                      },
                      finish_reason: null,
                    },
                  ],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
                );
              }
            } catch {
              // Ignore malformed upstream SSE lines
            }
          }
        }

        // Process final output
        if (toolsRequested) {
          const extracted = extractToolCalls(accumulatedContent, true);

          if (extracted.isToolCall && extracted.toolCalls.length > 0) {
            const toolCallsChunk: ChatCompletionChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: requestedModel,
              choices: [
                {
                  index: 0,
                  delta: {
                    role: 'assistant',
                    tool_calls: extracted.toolCalls.map((tc, idx) => ({
                      index: idx,
                      id: tc.id,
                      type: 'function',
                      function: tc.function,
                    })),
                  },
                  finish_reason: 'tool_calls',
                },
              ],
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(toolCallsChunk)}\n\n`)
            );
          } else {
            // Emits standard content if no tool call was found
            const contentChunk: ChatCompletionChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: requestedModel,
              choices: [
                {
                  index: 0,
                  delta: {
                    role: 'assistant',
                    content: accumulatedContent,
                    reasoning_content: accumulatedReasoning || null,
                  },
                  finish_reason: 'stop',
                },
              ],
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`)
            );
          }
        } else {
          // Final stop chunk for direct stream
          const stopChunk: ChatCompletionChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: requestedModel,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`)
          );
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
