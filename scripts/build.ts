import esbuild from 'esbuild';
import fs from 'node:fs/promises';

async function build(): Promise<void> {
  console.log('[Web2API] Starting build pipeline...');

  await fs.rm('dist', { recursive: true, force: true });
  await fs.mkdir('dist', { recursive: true });

  // 1. Build CLI executable for Node.js
  console.log('[Web2API] Bundling CLI daemon (dist/cli.js)...');
  await esbuild.build({
    entryPoints: ['src/cli/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: 'dist/cli.js',
    sourcemap: true,
  });

  // 2. Make CLI binary executable on POSIX systems
  try {
    await fs.chmod('dist/cli.js', 0o755);
  } catch {
    // Ignore chmod errors on Windows
  }

  // 3. Build standalone zero-dependency Cloudflare Worker (worker.js)
  console.log('[Web2API] Bundling standalone Cloudflare Worker (worker.js)...');
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'neutral',
    target: 'es2022',
    format: 'esm',
    outfile: 'worker.js',
    minify: false,
    sourcemap: false,
  });

  const cliStats = await fs.stat('dist/cli.js');
  const workerStats = await fs.stat('worker.js');

  console.log(`✓ CLI Daemon bundled:   dist/cli.js (${(cliStats.size / 1024).toFixed(1)} KB)`);
  console.log(`✓ Cloudflare Worker:   worker.js   (${(workerStats.size / 1024).toFixed(1)} KB)`);
  console.log('[Web2API] Build completed successfully!\n');
}

build().catch((err) => {
  console.error('[Web2API] Build failed:', err);
  process.exit(1);
});
