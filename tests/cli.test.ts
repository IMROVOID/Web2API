import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../src/cli/args.js';

describe('cli args parser', () => {
  it('defaults to start command when no arguments provided', () => {
    const parsed = parseCliArgs([]);
    assert.equal(parsed.command, 'start');
    assert.equal(parsed.help, false);
    assert.equal(parsed.version, false);
    assert.equal(parsed.port, undefined);
  });

  it('parses start command with port and host', () => {
    const parsed = parseCliArgs(['start', '--port', '8080', '--host', '0.0.0.0']);
    assert.equal(parsed.command, 'start');
    assert.equal(parsed.port, 8080);
    assert.equal(parsed.host, '0.0.0.0');
  });

  it('parses short flags -p and -k', () => {
    const parsed = parseCliArgs(['-p', '9000', '-k', 'sk-secret-key']);
    assert.equal(parsed.command, 'start');
    assert.equal(parsed.port, 9000);
    assert.equal(parsed.key, 'sk-secret-key');
  });

  it('parses check command', () => {
    const parsed = parseCliArgs(['check', '--upstream', 'https://custom-upstream.example.com']);
    assert.equal(parsed.command, 'check');
    assert.equal(parsed.upstream, 'https://custom-upstream.example.com');
  });

  it('parses --help flag', () => {
    const parsed = parseCliArgs(['--help']);
    assert.equal(parsed.command, 'help');
    assert.equal(parsed.help, true);
  });

  it('parses -v / --version flag', () => {
    const parsed = parseCliArgs(['-v']);
    assert.equal(parsed.command, 'version');
    assert.equal(parsed.version, true);
  });

  it('handles invalid port numbers gracefully', () => {
    const parsed = parseCliArgs(['--port', 'not-a-number']);
    assert.equal(parsed.port, undefined);
  });

  it('captures unknown arguments', () => {
    const parsed = parseCliArgs(['start', '--unexpected-flag']);
    assert.deepEqual(parsed.unknownArgs, ['--unexpected-flag']);
  });
});
