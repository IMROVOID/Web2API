# Web2API MVP Architecture Specification

Universal OpenAI-compatible reverse proxy bridging web chat backends (such as FreeModels.Pro) to coding agents ([MiMo-Code](https://github.com/XiaomiMiMo/MiMo-Code), Aider, Claude Code, Cline).

---

## 1. System Architecture

```
+-------------------------------------------------------------+
|                     Coding Agent CLI                        |
|        (MiMo-Code, Aider, Claude Code, Cline)               |
+------------------------------+------------------------------+
                               |
                               | POST /v1/chat/completions
                               | (OpenAI Schema: messages, tools, stream)
                               v
+-------------------------------------------------------------+
|                Web2API Universal Reverse Proxy              |
|        (Hono on Node.js / Cloudflare Workers)               |
|                                                             |
|  1. Prompt Coercer:                                         |
|     - Transforms `tools` into strict system instructions    |
|     - Injects negative constraints against markdown         |
|                                                             |
|  2. Upstream Client:                                        |
|     - Injects browser headers (Origin, Referer, User-Agent) |
|     - Translates payload: { messages, modelId, stream }     |
|                                                             |
|  3. JSON Extractor & Sanitizer:                             |
|     - Strips markdown fences (```json ... ```)              |
|     - Balanced-brace JSON parser & quote repair             |
|     - Formats into OpenAI `tool_calls` payload              |
|                                                             |
|  4. Stream Transformer:                                     |
|     - Real-time OpenAI chunking                             |
|     - Reasoning trace extraction (`reasoning_content`)      |
|     - Smart tool buffering in streaming mode                |
+------------------------------+------------------------------+
                               |
                               | POST https://freemodels-chat.freemodels.workers.dev/
                               v
+-------------------------------------------------------------+
|                     Upstream Gateway                        |
|   (Cloudflare Worker -> Nvidia NIM / DashScope Models)      |
+-------------------------------------------------------------+
```

---

## 2. Core Modules & Responsibilities

### 2.1 Universal Entry Points
- **`src/index.ts`**: Universal Hono app. Configures CORS, logging, error boundaries, and mounts routes.
  - Exported for Cloudflare Workers: `export default app`.
- **`src/server.ts`**: Local Node.js launcher using `@hono/node-server`.
  - Reads `PORT` (default: 8000) and prints connection banner.

### 2.2 Prompt Coercion Engine (`src/services/prompt-coercer.ts`)
Web models lack native `tool_choice` or function calling APIs. When a coding agent sends a request with `tools`:
1. The tool schemas are converted into an explicit JSON contract:
   ```json
   {
     "name": "tool_name",
     "arguments": { "key": "val" }
   }
   ```
2. The instruction is merged into the message chain.
   > **Note**: Because upstream web backends often strip or override the `system` role with their own persona, our coercer prepends or appends the directive to the latest user message or merges it into a synthetic prompt block to guarantee delivery.
3. Negative prompting is applied: "Do NOT use markdown code fences, do not output pleasantries or conversational text."

### 2.3 Resilient JSON Extractor (`src/services/json-extractor.ts`)
Models occasionally wrap JSON in markdown fences (````json ... ````) or include conversational preambles.
The extractor performs a 4-stage pipeline:
1. **Fence Removal**: Regex stripping of leading/trailing ````json ... ````.
2. **Brace Extraction**: Regex and balanced-brace scanning to locate the outer JSON object `{...}` or array `[...]`.
3. **JSON Repair**: Basic escaping normalization for unescaped newlines and single quotes.
4. **Tool Call Verification**: Verifies presence of `name` and `arguments`. Formats into OpenAI `tool_calls` schema with unique IDs (`call_...`).

### 2.4 Stream Transformer (`src/services/stream-transformer.ts`)
- **Direct Text Streaming**: When no `tools` are present, upstream SSE chunks (`delta.content` and `delta.reasoning_content`) are piped directly to the client as standard OpenAI `chat.completion.chunk` events.
- **Tool Buffering in Streaming**: When `tools` are active, the stream is buffered. Once complete:
  - If a tool call is detected, emits an OpenAI `tool_calls` delta chunk with `finish_reason: "tool_calls"`.
  - If plain text is returned, flushes the buffered text as `delta.content` with `finish_reason: "stop"`.

---

## 3. Agent Integration Configurations

### 3.1 MiMo-Code Configuration (`mimo`)
Run `mimo` and configure a custom provider:
```bash
# Base URL:
http://127.0.0.1:8000/v1

# API Key:
sk-web2api-local

# Model:
claude-sonnet-5 (or terra, sol, glm-5.2, kimi-k3)
```

### 3.2 Aider Configuration
```bash
aider --openai-api-base http://127.0.0.1:8000/v1 \
      --openai-api-key sk-web2api-local \
      --model openai/claude-sonnet-5
```

### 3.3 Cloudflare Workers Deployment
```bash
npm run build
npx wrangler deploy
```
Once deployed, set Base URL to `https://<your-worker-subdomain>.workers.dev/v1`.
