import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chatRouter } from './routes/chat.js';
import { modelsRouter } from './routes/models.js';
import { healthRouter } from './routes/health.js';

export const app = new Hono();

// Global CORS Middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'Retry-After'],
    maxAge: 86400,
  })
);

// Optional API_KEY Authentication Middleware
app.use('/v1/*', async (c, next) => {
  const envKey =
    (c.env as Record<string, string> | undefined)?.API_KEY ||
    (typeof process !== 'undefined' ? process.env?.API_KEY : undefined);

  if (envKey) {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token || token !== envKey) {
      return c.json(
        {
          error: {
            message: 'Invalid or missing API key',
            type: 'authentication_error',
            code: 401,
          },
        },
        401
      );
    }
  }
  await next();
});

// Route Mounts
app.route('/v1/chat/completions', chatRouter);
app.route('/v1/models', modelsRouter);
app.route('/health', healthRouter);
app.route('/', healthRouter);

// 404 Handler
app.notFound((c) => {
  return c.json(
    {
      error: {
        message: `Endpoint not found: ${c.req.method} ${c.req.path}`,
        type: 'invalid_request_error',
        code: 404,
      },
    },
    404
  );
});

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Proxy Error:', err);
  return c.json(
    {
      error: {
        message: err.message || 'Internal server error',
        type: 'api_error',
        code: 500,
      },
    },
    500
  );
});

export default app;
