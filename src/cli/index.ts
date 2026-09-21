#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { app } from '../index.js';
import { DEFAULT_PORT } from '../config.js';
import { parseCliArgs, type ParsedCliArgs } from './args.js';
import { runCheck } from './checker.js';

const VERSION = '1.0.0';

function showHelp(): void {
  console.log(`
Web2API CLI v${VERSION}
Universal OpenAI-compatible reverse proxy for FreeModels.Pro

Usage:
  web2api [command] [options]
  npx web2api-proxy [command] [options]

Commands:
  start                     Start the local reverse proxy daemon (default)
  check                     Run diagnostics on upstream connectivity and models
  help                      Display this help message
  version                   Display version information

Options:
  -p, --port <port>         Port to listen on (default: 8000, env: PORT)
      --host <host>         Host address to bind to (default: 127.0.0.1, env: HOST)
  -k, --key <apiKey>        Enforce Bearer API Key auth (env: API_KEY)
  -u, --upstream <url>      Override upstream chat backend URL (env: UPSTREAM_URL)
  -m, --model <model>       Override default model (default: claude-sonnet-5)
  -h, --help                Show help
  -v, --version             Show version

Examples:
  npx web2api-proxy
  npx web2api-proxy start --port 8080 --key sk-my-secret
  npx web2api-proxy check
  web2api start --port 8000
`);
}

function printBanner(host: string, port: number, apiKey?: string): void {
  const baseUrl = `http://${host}:${port}`;
  const keyDisplay = apiKey ? `Enabled (Bearer ${apiKey})` : 'Disabled (Open access / sk-web2api-local)';

  console.log(`
========================================================
🚀 Web2API Reverse Proxy Daemon is running!
   Local Base URL: ${baseUrl}/v1
   Chat Endpoint:  ${baseUrl}/v1/chat/completions
   Models List:    ${baseUrl}/v1/models
   Health Check:   ${baseUrl}/health
   Auth Status:    ${keyDisplay}
--------------------------------------------------------
💡 Quick Client Integration:

   1. Claude Code:
      export OPENAI_BASE_URL="${baseUrl}/v1"
      export OPENAI_API_KEY="${apiKey ?? 'sk-web2api-local'}"
      export ANTHROPIC_MODEL="claude-sonnet-5"

   2. Cursor / Cline / Roo Code / MiMoCode:
      Base URL: ${baseUrl}/v1
      API Key:  ${apiKey ?? 'sk-web2api-local'}
      Model:    claude-sonnet-5 (or terra, sol, glm-5.2)

   3. Aider:
      aider --openai-api-base ${baseUrl}/v1 \\
            --openai-api-key ${apiKey ?? 'sk-web2api-local'} \\
            --model openai/claude-sonnet-5
========================================================
Press Ctrl+C to stop the daemon.
`);
}

async function runStart(parsed: ParsedCliArgs): Promise<void> {
  const port = parsed.port ?? (Number(process.env.PORT) || DEFAULT_PORT);
  const host = parsed.host ?? (process.env.HOST || '127.0.0.1');
  const apiKey = parsed.key ?? process.env.API_KEY;

  if (parsed.key) process.env.API_KEY = parsed.key;
  if (parsed.upstream) process.env.UPSTREAM_URL = parsed.upstream;
  if (parsed.model) process.env.DEFAULT_MODEL = parsed.model;

  const server = serve(
    {
      fetch: app.fetch,
      port,
      hostname: host,
    },
    () => {
      printBanner(host, port, apiKey);
    }
  );

  const shutdown = (): void => {
    console.log('\n[Web2API] Shutting down daemon gracefully...');
    server.close(() => {
      console.log('[Web2API] Daemon stopped. Goodbye!');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseCliArgs(argv);

  switch (parsed.command) {
    case 'help':
      showHelp();
      break;
    case 'version':
      console.log(`v${VERSION}`);
      break;
    case 'check': {
      const result = await runCheck(parsed.upstream);
      if (!result.success) {
        process.exitCode = 1;
      }
      break;
    }
    case 'start':
    default:
      await runStart(parsed);
      break;
  }
}

// Direct execution check
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('cli.js')) {
  main().catch((err) => {
    console.error('[Web2API] Fatal error:', err);
    process.exit(1);
  });
}
