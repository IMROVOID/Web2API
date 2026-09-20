export type OpenAIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIFunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface OpenAITool {
  type: 'function';
  function: OpenAIFunctionDefinition;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIMessage {
  role: OpenAIMessageRole;
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  reasoning_content?: string | null;
}

export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: string | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamingToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ChatCompletionChunkDelta {
  role?: OpenAIMessageRole;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: StreamingToolCallDelta[];
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: ChatCompletionChunkDelta;
    finish_reason: 'stop' | 'tool_calls' | null;
  }>;
}

export interface UpstreamMessage {
  role: string;
  content: string;
}

export interface UpstreamPayload {
  messages: UpstreamMessage[];
  modelId: string;
  thinking: boolean;
  deepSearch: boolean;
  stream: boolean;
}

export interface UpstreamResponse {
  content?: string;
  error?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  name: string;
  description: string;
  supports_tools: boolean;
  supports_thinking: boolean;
}
