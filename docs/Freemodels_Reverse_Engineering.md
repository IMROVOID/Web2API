# FreeModels.Pro Architecture & Reverse Engineering Analysis

## 1. Executive Summary

`https://freemodels.pro` is a free AI chat web application offering access to flagship models (Claude Sonnet 5, Claude Fable 5, GPT 5.6 Sol, GPT 5.6 Terra, GLM 5.2, Kimi K3) without signup or credit cards.

Inspection of the web client, network traffic, and upstream responses reveals that the site does not connect directly to Anthropic or OpenAI. Instead, it operates a Cloudflare Worker gateway that proxies high-parameter open-weight reasoning models (specifically `nvidia/nemotron-3-super-120b-a12b` via Nvidia NIM and DashScope) conditioned with system personas to emulate the requested target models.

---

## 2. Infrastructure & Endpoints

| Component | Location / URL | Description |
|---|---|---|
| **Web Frontend** | `https://freemodels.pro/chat` | React 19 SPA bundled with Vite |
| **Static Assets** | `https://freemodels.pro/assets/index-DZ7nXOFB.js` | Contains client router, model catalog, and fetch logic |
| **Upstream Backend** | `https://freemodels-chat.freemodels.workers.dev/` | Cloudflare Worker handling chat generation and provider aggregation |
| **Actual Model Provider** | Nvidia NIM (`nvidia/nemotron-3-super-120b-a12b`), DashScope | Aggregated pool of API keys configured in the Worker |

---

## 3. Network Request Specification

### Endpoint
`POST https://freemodels-chat.freemodels.workers.dev/`

### Required Headers
```http
POST / HTTP/1.1
Host: freemodels-chat.freemodels.workers.dev
Content-Type: application/json
Origin: https://freemodels.pro
Referer: https://freemodels.pro/
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36
```
> **Note**: The upstream Cloudflare Worker enforces CORS headers (`Access-Control-Allow-Origin: https://freemodels.pro`). Direct server-to-server requests from Node.js or Cloudflare Workers must include `Origin` and `Referer` to avoid throttling.

### Request Body Schema
```json
{
  "messages": [
    {
      "role": "user",
      "content": "User prompt text here"
    }
  ],
  "modelId": "claude-sonnet-5",
  "thinking": false,
  "deepSearch": false,
  "stream": true
}
```

### Available Upstream `modelId` Values
| `modelId` | Display Name | Underlying Architecture | Status |
|---|---|---|---|
| `claude-sonnet-5` | Claude Sonnet 5 | Nemotron-3 Super 120B (Anthropic persona + thinking) | Active |
| `claude-fable-5` | Claude Fable 5 | Nemotron-3 Super 120B (Creative persona) | Active |
| `claude-fable-5.1` | Claude Fable 5.1 | Nemotron-3 Super 120B (Coding persona) | Intermittent (Key exhaustion) |
| `sol` | GPT 5.6 Sol | Nemotron-3 Super 120B (Fast conversational) | Active |
| `terra` | GPT 5.6 Terra | Nemotron-3 Super 120B (Deep reasoning) | Active |
| `glm-5.2` | GLM 5.2 | DashScope / Z.AI emulation | Active |
| `kimi-k3` | Kimi K3 | Moonshot AI emulation (Long context) | Active |

---

## 4. Response Protocol

The upstream backend supports both non-streaming JSON and streaming Server-Sent Events (SSE).

### A. Non-Streaming Response (`stream: false`)
When `stream: false` is requested:
```json
{
  "content": "4"
}
```
Or when tool calling prompt coercion is used:
```json
{
  "content": "{\"name\": \"get_weather\", \"arguments\": {\"city\": \"Tokyo\"}}"
}
```

### B. Streaming Response (`stream: true`)
When `stream: true`, the response is `text/event-stream`. Each chunk follows the OpenAI `chat.completion.chunk` schema:

1. **Reasoning / Thinking Chunks**:
   ```
   data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"We need to output..."}}],"model":"nvidia/nemotron-3-super-120b-a12b","object":"chat.completion.chunk"}
   ```
2. **Content Chunks**:
   ```
   data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"content":"4","role":"assistant"},"finish_reason":"stop"}],"model":"nvidia/nemotron-3-super-120b-a12b","object":"chat.completion.chunk"}
   ```
3. **Termination**:
   ```
   data: [DONE]
   ```

---

## 5. Rate Limits & Error Behaviors

When upstream provider keys (Nvidia NIM / DashScope) run out of quota, the worker returns:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{"error":"All providers exhausted (Nvidia 1 keys + DashScope 3 keys x 64 models). Retry in 20s. Raw: The free quota has been exhausted..."}
```

### Proxy Mitigation Strategies
1. **Model Fallback**: If `claude-fable-5.1` returns 429, fall back to `claude-sonnet-5` or `terra`.
2. **Retry-After Backoff**: Parse the `Retry in 20s` string and propagate `Retry-After: 20` header to the coding agent.
3. **Error Normalization**: Wrap upstream 429 errors into OpenAI standard `{ "error": { "message": "...", "type": "rate_limit_error", "code": 429 } }`.
