import { Hono } from 'hono';
import { SUPPORTED_MODELS } from '../config.js';

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Web2API Reverse Proxy',
    version: '1.0.0',
    endpoints: {
      chat_completions: '/v1/chat/completions',
      models: '/v1/models',
    },
    models_available: SUPPORTED_MODELS.map((m) => m.id),
  });
});
