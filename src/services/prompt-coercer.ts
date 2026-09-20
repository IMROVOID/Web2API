import type { OpenAIMessage, OpenAITool, UpstreamMessage } from '../types.js';

export function buildToolInstruction(tools: OpenAITool[]): string {
  const compactTools = tools.map((t) => ({
    name: t.function.name,
    description: t.function.description || '',
    parameters: t.function.parameters || {},
  }));

  return (
    '\n\n[CRITICAL SYSTEM DIRECTIVE: FUNCTION CALLING MODE]\n' +
    'You have access to the following tools:\n' +
    JSON.stringify(compactTools, null, 2) +
    '\n\n' +
    'To call a tool, you MUST respond ONLY with a raw JSON object in this exact schema:\n' +
    '{\n' +
    '  "name": "tool_name",\n' +
    '  "arguments": { ... }\n' +
    '}\n' +
    'Rules:\n' +
    '1. Do NOT wrap the JSON in markdown code fences (no ```json or ```).\n' +
    '2. Do NOT include conversational greetings, explanations, or postscripts.\n' +
    '3. Output MUST be parseable by JSON.parse.'
  );
}

export function coerceMessages(
  messages: OpenAIMessage[],
  tools?: OpenAITool[]
): UpstreamMessage[] {
  if (!messages || messages.length === 0) {
    return [{ role: 'user', content: '' }];
  }

  const normalized: UpstreamMessage[] = [];

  for (const msg of messages) {
    let content = msg.content || '';

    // If message was an assistant tool call, serialize it as JSON
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const firstCall = msg.tool_calls[0];
      try {
        const parsedArgs = JSON.parse(firstCall.function.arguments);
        content = JSON.stringify({
          name: firstCall.function.name,
          arguments: parsedArgs,
        });
      } catch {
        content = JSON.stringify({
          name: firstCall.function.name,
          arguments: firstCall.function.arguments,
        });
      }
    }

    // If message is a tool response, present it clearly to the model
    if (msg.role === 'tool') {
      const toolName = msg.name || 'tool';
      normalized.push({
        role: 'user',
        content: `[Tool Result for "${toolName}"]:\n${content}`,
      });
      continue;
    }

    normalized.push({
      role: msg.role === 'system' ? 'user' : msg.role,
      content,
    });
  }

  // Inject tool instructions if tools are provided
  if (tools && tools.length > 0) {
    const instruction = buildToolInstruction(tools);
    let injected = false;

    // Search from end to find last user message
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalized[i].role === 'user') {
        normalized[i].content += instruction;
        injected = true;
        break;
      }
    }

    // Fallback: append to last message if no user role found
    if (!injected && normalized.length > 0) {
      normalized[normalized.length - 1].content += instruction;
    }
  }

  return normalized;
}
