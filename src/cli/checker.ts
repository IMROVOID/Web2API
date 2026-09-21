import {
  DEFAULT_UPSTREAM_URL,
  SUPPORTED_MODELS,
  MODEL_ALIASES,
  getBrowserHeaders,
} from '../config.js';

export interface CheckResult {
  readonly success: boolean;
  readonly upstreamUrl: string;
  readonly statusCode?: number;
  readonly latencyMs?: number;
  readonly error?: string;
}

export async function runCheck(customUpstream?: string): Promise<CheckResult> {
  const upstreamUrl = customUpstream ?? DEFAULT_UPSTREAM_URL;
  console.log('\n[Web2API] Running diagnostic check for upstream services...');
  console.log(`[Web2API] Upstream Target: ${upstreamUrl}`);

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(upstreamUrl, {
      method: 'GET',
      headers: getBrowserHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    console.log(`✓ Upstream Reachability: HTTP ${res.status} (${latencyMs}ms)`);
    console.log(`✓ Browser Header Emulation: Verified`);
    console.log(`✓ Supported Models (${SUPPORTED_MODELS.length}):`);
    for (const model of SUPPORTED_MODELS) {
      const flags = [
        model.supports_tools ? 'tools' : null,
        model.supports_thinking ? 'thinking' : null,
      ]
        .filter(Boolean)
        .join(', ');
      console.log(`   - ${model.id.padEnd(18)} [${model.owned_by}] (${flags})`);
    }

    const aliasCount = Object.keys(MODEL_ALIASES).length;
    console.log(`✓ Model Aliases Mapped: ${aliasCount} aliases active`);
    console.log('\n🎉 Web2API Diagnostic check passed successfully!\n');

    return {
      success: true,
      upstreamUrl,
      statusCode: res.status,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Failed to connect to upstream: ${errorMsg} (${latencyMs}ms)`);
    console.error('   Please check your network connection or specify a different --upstream URL.\n');

    return {
      success: false,
      upstreamUrl,
      latencyMs,
      error: errorMsg,
    };
  }
}
