import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readWalk, WALK_DEFAULTS, walkArgs, walkLines } from './walk-report.ts';

void test('the walk takes a build address, a Chrome and a port, and falls back to a local dev server and the usual Chrome', (): void => {
  assert.deepEqual(walkArgs([], {}), { url: null, chrome: WALK_DEFAULTS.chrome, port: WALK_DEFAULTS.port, hero: WALK_DEFAULTS.hero });
  assert.deepEqual(walkArgs(['--url', 'http://localhost:5173/', '--port', '6001', '--hero', 'man'], { CHROME_PATH: '/opt/chrome' }), { url: 'http://localhost:5173', chrome: '/opt/chrome', port: 6001, hero: 'man' });
  assert.throws((): unknown => walkArgs(['--hero', 'Wo man'], {}));
  assert.equal(walkArgs(['--chrome', '/x/chrome'], { CHROME_PATH: '/opt/chrome' }).chrome, '/x/chrome');
  assert.throws((): unknown => walkArgs(['--port', 'abc'], {}));
});

void test('a walk report from the page is read strictly and printed one look per line', (): void => {
  const summary = readWalk({ ok: false, looks: [{ zone: 'hall_of_time', afterMs: 2500, live: 12, missing: [] }, { zone: 'keepers_gate', afterMs: 9000, live: 1, missing: ['timekeeper_gatekeeper#17'] }], problems: ['keepers_gate after 9000 ms: 1 of 1 live monsters have no body (timekeeper_gatekeeper#17)'] });
  const lines: string[] = walkLines(summary);
  assert.match(lines[0] ?? '', /^ok {3}hall_of_time .* 12\/12 drawn$/);
  assert.match(lines[1] ?? '', /^FAIL keepers_gate .* 0\/1 drawn {2}missing: timekeeper_gatekeeper#17$/);
  assert.equal(lines.at(-1), 'BODY WALK FAILED');
  assert.throws((): unknown => readWalk({ ok: 'yes', looks: [], problems: [] }));
  assert.throws((): unknown => readWalk({ ok: true, looks: [{ zone: 'x' }], problems: [] }));
});
