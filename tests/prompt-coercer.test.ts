import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildToolInstruction,
  coerceMessages,
} from '../src/services/prompt-coercer.js';
import type { OpenAIMessage, OpenAITool } from '../src/types.js';

describe('prompt-coercer', () => {
  const sampleTools: OpenAITool[] = [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
          required: ['city'],
        },
      },
    },
  ];

  it('builds tool instruction containing tool name and critical directive', () => {
    const instruction = buildToolInstruction(sampleTools);
    assert.match(instruction, /CRITICAL SYSTEM DIRECTIVE/);
    assert.match(instruction, /get_weather/);
    assert.match(instruction, /Do NOT wrap the JSON in markdown code fences/);
  });

  it('passes normal messages through when no tools provided', () => {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hi' },
    ];
    const coerced = coerceMessages(messages);
    assert.equal(coerced.length, 2);
    assert.equal(coerced[1].content, 'Hi');
    assert.doesNotMatch(coerced[1].content, /CRITICAL SYSTEM DIRECTIVE/);
  });

  it('injects tool instruction into the last user message', () => {
    const messages: OpenAIMessage[] = [
      { role: 'user', content: 'What is the weather in Tokyo?' },
    ];
    const coerced = coerceMessages(messages, sampleTools);
    assert.equal(coerced.length, 1);
    assert.match(coerced[0].content, /What is the weather in Tokyo\?/);
    assert.match(coerced[0].content, /CRITICAL SYSTEM DIRECTIVE/);
    assert.match(coerced[0].content, /get_weather/);
  });

  it('handles multi-turn conversation with prior tool call and tool result', () => {
    const messages: OpenAIMessage[] = [
      { role: 'user', content: 'Check weather in Tokyo' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"city":"Tokyo"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        name: 'get_weather',
        tool_call_id: 'call_123',
        content: '{"temp": 18, "condition": "Sunny"}',
      },
      { role: 'user', content: 'Now check Kyoto' },
    ];

    const coerced = coerceMessages(messages, sampleTools);
    assert.equal(coerced.length, 4);

    // Assistant tool call was serialized to JSON
    assert.match(coerced[1].content, /get_weather/);
    assert.match(coerced[1].content, /Tokyo/);

    // Tool result was wrapped as user context
    assert.match(coerced[2].content, /\[Tool Result for "get_weather"\]/);
    assert.match(coerced[2].content, /Sunny/);

    // Final user message received the active tool instruction
    assert.match(coerced[3].content, /Now check Kyoto/);
    assert.match(coerced[3].content, /CRITICAL SYSTEM DIRECTIVE/);
  });
});
