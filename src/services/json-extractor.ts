import type { OpenAIToolCall } from '../types.js';

export interface ExtractionResult {
  isToolCall: boolean;
  toolCalls: OpenAIToolCall[];
  content: string | null;
}

export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  // Remove starting ```json or ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Remove ending ```
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

export function extractJsonCandidate(text: string): string | null {
  const cleaned = stripMarkdownFences(text);

  // First try direct parse of cleaned text
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Continue to balanced extraction
  }

  // Find outer matching braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try repair
      const repaired = repairJson(candidate);
      try {
        JSON.parse(repaired);
        return repaired;
      } catch {
        // Continue
      }
    }
  }

  return null;
}

function repairJson(jsonStr: string): string {
  return jsonStr
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, '$1')
    // Replace unescaped newlines inside strings
    .replace(/\n(?=(?:(?:[^\"]*\"){2})*[^\"]*\"[^\"]*$)/g, '\\n');
}

export function extractToolCalls(
  rawText: string,
  toolsRequested: boolean
): ExtractionResult {
  if (!toolsRequested || !rawText || !rawText.trim()) {
    return {
      isToolCall: false,
      toolCalls: [],
      content: rawText,
    };
  }

  const jsonCandidate = extractJsonCandidate(rawText);

  if (jsonCandidate) {
    try {
      const parsed: unknown = JSON.parse(jsonCandidate);

      // Case 1: Single tool call object { name: string, arguments?: object | string }
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        'name' in parsed &&
        typeof (parsed as Record<string, unknown>).name === 'string'
      ) {
        const obj = parsed as Record<string, unknown>;
        const args = obj.arguments;
        const serializedArgs =
          typeof args === 'string' ? args : JSON.stringify(args || {});

        const toolCall: OpenAIToolCall = {
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          type: 'function',
          function: {
            name: obj.name as string,
            arguments: serializedArgs,
          },
        };

        return {
          isToolCall: true,
          toolCalls: [toolCall],
          content: null,
        };
      }

      // Case 2: Array of tool calls [{ name, arguments }]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validCalls: OpenAIToolCall[] = [];
        for (const item of parsed) {
          if (
            item &&
            typeof item === 'object' &&
            'name' in item &&
            typeof item.name === 'string'
          ) {
            const args = item.arguments;
            validCalls.push({
              id: `call_${Math.random().toString(36).slice(2, 10)}`,
              type: 'function',
              function: {
                name: item.name as string,
                arguments:
                  typeof args === 'string' ? args : JSON.stringify(args || {}),
              },
            });
          }
        }

        if (validCalls.length > 0) {
          return {
            isToolCall: true,
            toolCalls: validCalls,
            content: null,
          };
        }
      }
    } catch {
      // Fallback to text content
    }
  }

  // Not a valid tool call, treat as standard text output
  return {
    isToolCall: false,
    toolCalls: [],
    content: rawText,
  };
}
