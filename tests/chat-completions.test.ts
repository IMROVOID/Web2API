import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { resolveModelId } from '../src/config.js';

describe('chat-completions & router endpoints', () => {
  it('resolves model aliases correctly', () => {
    assert.equal(resolveModelId('gpt-4o'), 'terra');
    assert.equal(resolveModelId('gpt-4o-mini'), 'sol');
    assert.equal(resolveModelId('claude-3-5-sonnet'), 'claude-sonnet-5');
    assert.equal(resolveModelId('claude-sonnet-5'), 'claude-sonnet-5');
    assert.equal(resolveModelId('unknown-model'), 'claude-sonnet-5');
  });

  it('GET /health returns 200 and available models', async () => {
    const res = await app.request('/health');
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.status, 'ok');
    assert.ok(Array.isArray(body.models_available));
    assert.ok((body.models_available as string[]).includes('claude-sonnet-5'));
  });

  it('GET /v1/models returns OpenAI model list format', async () => {
    const res = await app.request('/v1/models');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { object: string; data: Array<{ id: string }> };
    assert.equal(body.object, 'list');
    assert.ok(body.data.length >= 6);
    const modelIds = body.data.map((m) => m.id);
    assert.ok(modelIds.includes('claude-sonnet-5'));
    assert.ok(modelIds.includes('sol'));
    assert.ok(modelIds.includes('terra'));
  });

  it('GET /v1/models/:model returns 404 for invalid model', async () => {
    const res = await app.request('/v1/models/non-existent-model');
    assert.equal(res.status, 404);
  });

  it('POST /v1/chat/completions returns 400 when messages array is missing', async () => {
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-5' }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'missing_messages');
  });

  it('POST /v1/chat/completions returns 400 on invalid JSON payload', async () => {
    const res = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json-body',
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'invalid_payload');
  });
});
