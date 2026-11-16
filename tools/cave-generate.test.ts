import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CaveOptions } from './cave-generate.ts';
import { caveOptions, formatZone } from './cave-generate.ts';

void test('the command line names the zone, its doors and its band, and a gated way down waits for a visit', (): void => {
  const options: CaveOptions = caveOptions(['--id', 'deep', '--name', 'Deep', '--up', 'above:down', '--down', 'below:up', '--down-gate', 'below', '--from', '14', '--to', '17', '--seed', '5', '--packs', '30']);
  assert.equal(options.id, 'deep');
  assert.equal(options.seed, 5);
  assert.deepEqual(options.request.levels, { from: 14, to: 17 });
  assert.equal(options.request.packs, 30);
  assert.deepEqual(options.up, { id: 'up', to: 'above', toExit: 'down', requires: [], lockedHint: '', hiddenWhenLocked: false });
  assert.deepEqual(options.down?.requires, [{ type: 'visited', zone: 'below', not: false }]);
  assert.throws((): CaveOptions => caveOptions(['--id', 'deep']));
  assert.throws((): CaveOptions => caveOptions(['--id', 'deep', '--up', 'above']));
});

void test('a written zone reads back as the same record, one list entry per line', (): void => {
  const record: Record<string, unknown> = { id: 'deep', tiles: ['cc', 'c '], terrain: { rise: 1, levels: ['00', '0/'] }, packs: [{ x: 1, z: 2 }], exits: [] };
  const text: string = formatZone(record);
  assert.deepEqual(JSON.parse(text), record);
  assert.ok(text.includes('\n    "c "'));
  assert.ok(text.includes('"levels": [\n    "00",'));
});
