# Architectural Guide: Bridging Web Chat Interfaces to OpenAI-Compatible Agent Endpoints (Web2API)

## 1. Overview & Core Concept

Modern AI coding agents (e.g., [MiMo-Code](https://github.com/XiaomiMiMo/MiMo-Code), Aider, Claude Code) require an OpenAI-compatible API endpoint exposing `/v1/chat/completions` with support for structured JSON tool/function calling.

Web chat platforms (such as [FreeModels.Pro](https://freemodels.pro/chat/n1jyqovmua25r89)) do not offer standard developer APIs or OAuth client credentials. To route traffic between an agent CLI and a web-only chat interface, an intermediary **Web2API Reverse Proxy** must be deployed to translate request formats, inject authentication cookies, and parse raw responses.

## 2. System Architecture & Flow

```

+-------------------+
|  Coding Agent CLI | (MiMo-Code, Aider)
+---------+---------+
|
| HTTP POST /v1/chat/completions (OpenAI Schema + Tool Definitions)
v
+---------+---------+
| Local Proxy Layer | (FastAPI / Express / Node.js)
|  - Injects browser headers & session cookies
|  - Rewrites tool schemas into strict JSON system instructions
|  - Strips markdown formatting from model output
|  - Formats raw strings into OpenAI `tool_calls` payload
+---------+---------+
|
| Internal Web Request / WebSocket (Custom JSON / Form Data)
v
+---------+---------+
| Target Web Chat   | (e.g., freemodels.pro backend)
+-------------------+

```

## 3. Reverse Proxy Implementation (Python / FastAPI)

This proxy intercepts requests from the CLI agent, converts tool specifications into plain-text system prompts, calls the target web chat endpoint, extracts valid JSON, and returns the response in OpenAI's completion format.

```python
import json
import re
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="Web2API Bridge")

# Target web chat backend endpoint discovered via DevTools Network tab
TARGET_ENDPOINT = "[https://freemodels.pro/api/internal_chat](https://freemodels.pro/api/internal_chat)"

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Referer": "[https://freemodels.pro/](https://freemodels.pro/)",
    "Origin": "[https://freemodels.pro](https://freemodels.pro)",
    "Accept": "application/json, text/plain, */*",
    # Add active session cookies or CSRF tokens if required
    # "Cookie": "session_id=..."
}

def extract_json_from_text(raw_text: str) -> dict:
    """
    Cleans markdown wrappers, preamble text, and extracts raw JSON.
    """
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    
    # Locate first outer JSON object
    match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)
        
    return json.loads(cleaned)

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model", "claude-fable-5.1")
    tools = body.get("tools", [])

    # 1. Prompt Coercion: Convert function definitions into prompt text if tools exist
    if tools:
        tool_instruction = (
            "\n\n[CRITICAL SYSTEM DIRECTIVE]\n"
            "You have access to the following tools:\n"
            f"{json.dumps(tools, indent=2)}\n\n"
            "If you need to execute a tool, respond ONLY with a raw JSON object matching:\n"
            "{\n"
            '  "name": "tool_name",\n'
            '  "arguments": { ... }\n'
            "}\n"
            "Do NOT include markdown fences, greetings, or explanations."
        )
        # Inject into system prompt or append to the last message
        messages[-1]["content"] += tool_instruction

    # 2. Translate payload to target site format
    upstream_payload = {
        "model": model,
        "messages": messages,
        "stream": False
    }

    # 3. Forward request
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                TARGET_ENDPOINT, 
                json=upstream_payload, 
                headers=BROWSER_HEADERS
            )
            resp.raise_for_status()
            data = resp.json()
            raw_assistant_content = data.get("text") or data.get("content") or resp.text
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Upstream communication failure: {str(e)}")

    # 4. Parse response for tool calls
    parsed_tool = None
    if tools:
        try:
            parsed_tool = extract_json_from_text(raw_assistant_content)
        except Exception:
            parsed_tool = None

    # 5. Build OpenAI-compatible response object
    if parsed_tool and isinstance(parsed_tool, dict) and "name" in parsed_tool:
        choice = {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_proxy_001",
                        "type": "function",
                        "function": {
                            "name": parsed_tool.get("name"),
                            "arguments": json.dumps(parsed_tool.get("arguments", {}))
                        }
                    }
                ]
            },
            "finish_reason": "tool_calls"
        }
    else:
        choice = {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": raw_assistant_content
            },
            "finish_reason": "stop"
        }

    return JSONResponse(
        content={
            "id": "chatcmpl-web2api-bridge",
            "object": "chat.completion",
            "model": model,
            "choices": [choice]
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

```

## 4. Agent CLI Configuration

Configure the agent to route traffic through the local proxy.

### MiMo-Code Setup

1. Launch configuration: `mimo`
2. Select **Custom Provider**.
3. Set the following fields:

* **Base URL:** `http://127.0.0.1:8000/v1`
* **API Key:** `sk-local-proxy` (any non-empty placeholder)
* **Model:** Target model identifier matching upstream expectations

## 5. Technical Limitations & Agentic Breakdowns

Attempting to run production coding agents over web proxies introduces structural failure modes:

| Failure Mode | Root Cause | Impact on Coding Agents |
| --- | --- | --- |
| **No Native Tool Calling** | Web frontends lack schema enforcement APIs (`tool_choice`). | Model outputs conversational markdown or broken JSON, causing agent loops to crash. |
| **Aggressive Context Truncation** | Free frontends cut off long token histories to save compute. | Agent forgets workspace files, bash outputs, and project directory trees mid-refactor. |
| **System Prompt Collision** | Web platforms enforce hardcoded system guidelines. | Overrides the coding agent's internal rules regarding unified diff formats and safety bounds. |
| **WAF / Rate Throttling** | Cloudflare Turnstile, browser fingerprinting, and IP rate limits. | Rapid execution loops (10+ requests/min) trigger `403 Forbidden` or CAPTCHA pages. |
| **JSON Escaping Errors** | Large diffs contain quotes, escapes (`\n`, `\"`), and template literals. | Regex-based JSON extraction fails with syntax errors when models omit proper string escaping. |
| **Disabled Streaming** | Responses must be fully buffered to validate and sanitize JSON. | Increases agent latency; terminal displays no progressive output until execution finishes. |

## 6. Recommended Direct Alternatives for Agents

For stable, long-running agent workflows without enterprise subscription costs:

1. **Local Function-Calling Models via Ollama / vLLM**

* Models: `Qwen2.5-Coder-7B-Instruct` or `Qwen2.5-Coder-32B-Instruct`
* Exposes standard OpenAI API: `http://localhost:11434/v1`
* Native JSON Schema and function calling with full privacy and zero rate limits.

1. **Official Free-Tier Developer APIs**

* **Google AI Studio:** Free tier for Gemini Flash models via official OpenAI-compatible API keys.
* **OpenRouter Free Endpoints:** Direct access to open-weights models labeled `:free` with complete tool-calling schemas supported out of the box.
