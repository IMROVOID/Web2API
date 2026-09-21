export interface ParsedCliArgs {
  readonly command: 'start' | 'check' | 'help' | 'version';
  readonly port?: number;
  readonly host?: string;
  readonly key?: string;
  readonly upstream?: string;
  readonly model?: string;
  readonly help: boolean;
  readonly version: boolean;
  readonly unknownArgs: string[];
}

export function parseCliArgs(args: readonly string[]): ParsedCliArgs {
  let command: 'start' | 'check' | 'help' | 'version' | undefined;
  let port: number | undefined;
  let host: string | undefined;
  let key: string | undefined;
  let upstream: string | undefined;
  let model: string | undefined;
  let help = false;
  let version = false;
  const unknownArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--version' || arg === '-v') {
      version = true;
    } else if (arg === '--port' || arg === '-p') {
      const next = args[++i];
      if (next !== undefined) {
        const parsed = parseInt(next, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
          port = parsed;
        }
      }
    } else if (arg === '--host') {
      const next = args[++i];
      if (next !== undefined) host = next;
    } else if (arg === '--key' || arg === '-k') {
      const next = args[++i];
      if (next !== undefined) key = next;
    } else if (arg === '--upstream' || arg === '-u') {
      const next = args[++i];
      if (next !== undefined) upstream = next;
    } else if (arg === '--model' || arg === '-m') {
      const next = args[++i];
      if (next !== undefined) model = next;
    } else if (arg === 'start' || arg === 'check' || arg === 'help' || arg === 'version') {
      if (!command) command = arg;
    } else {
      unknownArgs.push(arg);
    }
  }

  if (help) command = 'help';
  else if (version) command = 'version';
  else if (!command) command = 'start';

  return {
    command,
    port,
    host,
    key,
    upstream,
    model,
    help,
    version,
    unknownArgs,
  };
}
