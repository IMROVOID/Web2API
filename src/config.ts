import type { ModelInfo } from './types.js';

export const DEFAULT_UPSTREAM_URL = 'https://freemodels-chat.freemodels.workers.dev';
export const DEFAULT_PORT = 8000;
export const DEFAULT_MODEL = 'claude-sonnet-5';

export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-5',
    object: 'model',
    created: 1735689600,
    owned_by: 'Anthropic',
    name: 'Claude Sonnet 5',
    description: 'Flagship reasoning model with extended thinking and superior coding',
    supports_tools: true,
    supports_thinking: true,
  },
  {
    id: 'claude-fable-5',
    object: 'model',
    created: 1735689600,
    owned_by: 'Anthropic',
    name: 'Claude Fable 5',
    description: 'Creative writing and storytelling with nuanced long form generation',
    supports_tools: true,
    supports_thinking: false,
  },
  {
    id: 'claude-fable-5.1',
    object: 'model',
    created: 1735689600,
    owned_by: 'Anthropic',
    name: 'Claude Fable 5.1',
    description: 'Improved creative model with agentic coding and superior research',
    supports_tools: true,
    supports_thinking: false,
  },
  {
    id: 'sol',
    object: 'model',
    created: 1735689600,
    owned_by: 'OpenAI',
    name: 'GPT 5.6 Sol',
    description: 'High speed ChatGPT Pro model optimized for quick insightful replies',
    supports_tools: true,
    supports_thinking: false,
  },
  {
    id: 'terra',
    object: 'model',
    created: 1735689600,
    owned_by: 'OpenAI',
    name: 'GPT 5.6 Terra',
    description: 'Deep reasoning ChatGPT Pro model with advanced problem solving',
    supports_tools: true,
    supports_thinking: true,
  },
  {
    id: 'glm-5.2',
    object: 'model',
    created: 1735689600,
    owned_by: 'Z.AI',
    name: 'GLM 5.2',
    description: 'Z.AI flagship with strong bilingual and tool calling abilities',
    supports_tools: true,
    supports_thinking: false,
  },
  {
    id: 'kimi-k3',
    object: 'model',
    created: 1735689600,
    owned_by: 'Moonshot AI',
    name: 'Kimi K3',
    description: 'Ultra long context model with 200K+ token window and recall',
    supports_tools: true,
    supports_thinking: false,
  },
];

export const MODEL_ALIASES: Record<string, string> = {
  'gpt-4o': 'terra',
  'gpt-4o-mini': 'sol',
  'gpt-4': 'terra',
  'claude-3-5-sonnet': 'claude-sonnet-5',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'claude-3-sonnet': 'claude-sonnet-5',
  'claude-3-opus': 'claude-sonnet-5',
  'claude-3-5-haiku': 'sol',
  'glm-4': 'glm-5.2',
  'kimi': 'kimi-k3',
};

export function resolveModelId(requestedModel: string): string {
  const normalized = requestedModel.trim().toLowerCase();
  if (MODEL_ALIASES[normalized]) {
    return MODEL_ALIASES[normalized];
  }
  const directMatch = SUPPORTED_MODELS.find(
    (m) => m.id.toLowerCase() === normalized
  );
  if (directMatch) {
    return directMatch.id;
  }
  return DEFAULT_MODEL;
}

export function getBrowserHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Origin': 'https://freemodels.pro',
    'Referer': 'https://freemodels.pro/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  };
}
