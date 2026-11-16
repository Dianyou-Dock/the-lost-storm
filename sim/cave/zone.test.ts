import assert from 'node:assert/strict';
import { test } from 'node:test';
import hourfall from '../../data/kits/hourfall.json' with { type: 'json' };
import { loadContent } from '../content/content.ts';
import { zone as readZone } from '../content/parse-world.ts';
import type { Content, ZoneDef } from '../content/types.ts';
import type { CaveResult } from './generate.ts';
import { generateCave } from './generate.ts';
import type { CaveKit } from './kit.ts';
import { readKit } from './kit.ts';
import { caveZoneRecord } from './zone.ts';

const content: Content = loadContent();
const kit: CaveKit = readKit(hourfall, 'hourfall');

void test('a generated cave is an ordinary zone: the kit dresses it, the entrance and the way down pair with the doors given, and the waypoint and checkpoints are its own', (): void => {
  const result: CaveResult = generateCave({ seed: 3, columns: 110, rows: 110, chambers: 10, levels: { from: 14, to: 17 }, packs: 18, packScale: 1, screen: { monsters: 20, lights: 12 } }, { kit, defs: content.props, judge: null });
  assert.ok(result.ok);
  const zone: ZoneDef = readZone(caveZoneRecord(result.layout, { id: 'cave_test', name: 'Test cave', up: { id: 'up', to: 'above', toExit: 'down', requires: [], lockedHint: '', hiddenWhenLocked: false }, down: { id: 'down', to: 'below', toExit: 'up', requires: [{ type: 'visited', zone: 'below', not: false }], lockedHint: '', hiddenWhenLocked: true } }, kit), 'cave_test');
  assert.equal(zone.kind, 'wild');
  assert.equal(zone.ranks, true);
  assert.deepEqual(zone.floors, hourfall.zone.floors);
  assert.equal(zone.level, 14);
  assert.equal(zone.levelUpTo, 17);
  assert.deepEqual(zone.exits.map((exit): string => `${exit.id}>${exit.to}.${exit.toExit}`), ['up>above.down', 'down>below.up']);
  assert.deepEqual(zone.exits[1]?.requires, [{ type: 'visited', zone: 'below', not: false }]);
  assert.ok(zone.waypoint !== null);
  assert.ok(zone.checkpoints.every((checkpoint): boolean => checkpoint.id.startsWith('cave_test_c')));
  assert.equal(zone.terrain?.levels.length, zone.tiles.length);
});
