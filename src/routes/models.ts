import { Hono } from 'hono';
import { SUPPORTED_MODELS } from '../config.js';

export const modelsRouter = new Hono();

modelsRouter.get('/', (c) => {
  return c.json({
    object: 'list',
    data: SUPPORTED_MODELS,
  });
});

modelsRouter.get('/:model', (c) => {
  const modelId = c.req.param('model');
  const model = SUPPORTED_MODELS.find(
    (m) => m.id.toLowerCase() === modelId.toLowerCase()
  );

  if (!model) {
    return c.json(
      {
        error: {
          message: `Model '${modelId}' not found`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
        },
      },
      404
    );
  }

  return c.json(model);
});
