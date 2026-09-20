import { app } from '../src/index.js';

async function runLiveTest() {
  console.log('Testing live non-streaming tool call through Hono app...');
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      messages: [
        { role: 'user', content: 'What is the weather in Tokyo?' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        },
      ],
    }),
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response body:', JSON.stringify(data, null, 2));
}

runLiveTest().catch(console.error);
