import { serve } from '@hono/node-server';
import { app } from './index.js';
import { DEFAULT_PORT } from './config.js';

const port = Number(process.env.PORT) || DEFAULT_PORT;

console.log(`
=====================================================
  Web2API Reverse Proxy (FreeModels.Pro Gateway)
=====================================================
  Listening on: http://127.0.0.1:${port}
  
  Endpoints:
    - Chat:   http://127.0.0.1:${port}/v1/chat/completions
    - Models: http://127.0.0.1:${port}/v1/models
    - Health: http://127.0.0.1:${port}/health

  Quick Integration for MiMo-Code (mimo):
    Provider: Custom
    Base URL: http://127.0.0.1:${port}/v1
    API Key:  sk-web2api-local
    Model:    claude-sonnet-5 (or terra, sol, glm-5.2)

  Quick Integration for Aider:
    aider --openai-api-base http://127.0.0.1:${port}/v1 \\
          --openai-api-key sk-web2api-local \\
          --model openai/claude-sonnet-5
=====================================================
`);

serve({
  fetch: app.fetch,
  port,
});
