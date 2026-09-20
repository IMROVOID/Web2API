import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripMarkdownFences,
  extractJsonCandidate,
  extractToolCalls,
} from '../src/services/json-extractor.js';

describe('json-extractor', () => {
  it('strips markdown json fences', () => {
    const input = '```json\n{"name": "test", "arguments": {}}\n```';
    assert.equal(
      stripMarkdownFences(input),
      '{"name": "test", "arguments": {}}'
    );
  });

  it('strips markdown plain fences', () => {
    const input = '```\n{"name": "test"}\n```';
    assert.equal(stripMarkdownFences(input), '{"name": "test"}');
  });

  it('extracts json candidate from preamble text', () => {
    const input = 'Sure, here is your tool call:\n{"name": "get_weather", "arguments": {"city": "Tokyo"}}\nHope this helps!';
    const candidate = extractJsonCandidate(input);
    assert.equal(
      candidate,
      '{"name": "get_weather", "arguments": {"city": "Tokyo"}}'
    );
  });

  it('extracts valid single tool call', () => {
    const raw = '{"name": "read_file", "arguments": {"path": "src/index.ts"}}';
    const result = extractToolCalls(raw, true);
    assert.equal(result.isToolCall, true);
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].function.name, 'read_file');
    assert.deepEqual(
      JSON.parse(result.toolCalls[0].function.arguments),
      { path: 'src/index.ts' }
    );
    assert.equal(result.content, null);
  });

  it('extracts tool call wrapped in markdown', () => {
    const raw = '```json\n{"name": "list_files", "arguments": {"dir": "./"}}\n```';
    const result = extractToolCalls(raw, true);
    assert.equal(result.isToolCall, true);
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].function.name, 'list_files');
  });

  it('extracts array of tool calls', () => {
    const raw = '[{"name": "tool_a", "arguments": {}}, {"name": "tool_b", "arguments": {"x": 1}}]';
    const result = extractToolCalls(raw, true);
    assert.equal(result.isToolCall, true);
    assert.equal(result.toolCalls.length, 2);
    assert.equal(result.toolCalls[0].function.name, 'tool_a');
    assert.equal(result.toolCalls[1].function.name, 'tool_b');
  });

  it('returns text content when no tools requested', () => {
    const raw = '{"name": "not_a_call"}';
    const result = extractToolCalls(raw, false);
    assert.equal(result.isToolCall, false);
    assert.equal(result.toolCalls.length, 0);
    assert.equal(result.content, raw);
  });

  it('returns text content when text is not a tool call', () => {
    const raw = 'Hello! I cannot execute tools right now.';
    const result = extractToolCalls(raw, true);
    assert.equal(result.isToolCall, false);
    assert.equal(result.toolCalls.length, 0);
    assert.equal(result.content, raw);
  });
});
