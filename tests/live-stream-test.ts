import { app } from '../src/index.js';

async function runLiveStreamTest() {
  console.log('Testing live streaming through Hono app...');
  const res = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sol',
      messages: [
        { role: 'user', content: 'Count from 1 to 3, one number per line' },
      ],
      stream: true,
    }),
  });

  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('No reader');
  }

  const decoder = new TextDecoder();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      const text = decoder.decode(chunk.value);
      for (const line of text.split('\n')) {
        if (line.trim().startsWith('data:')) {
          console.log('Chunk:', line.trim().slice(0, 100));
        }
      }
    }
  }
  console.log('Streaming test complete.');
}

runLiveStreamTest().catch(console.error);
