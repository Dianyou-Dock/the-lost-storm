import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../sim/content/content.ts';
import type { ZoneSweep } from './hidden-sweep.ts';
import { sweepFailed, sweepLines, sweepZones } from './hidden-sweep.ts';

const swept: ZoneSweep[] = sweepZones(loadContent());

void test('the cave rock hides the hero somewhere on the cave floor, and with the terrain cutaway it hides him nowhere in any zone', (): void => {
  assert.ok(swept.reduce((sum: number, zone: ZoneSweep): number => sum + zone.hidden, 0) > 0);
  for (const zone of swept) assert.deepEqual(zone.cutHidden, [], `${zone.zone}: hero hidden at ${zone.cutHidden.slice(0, 12).join(' ')} of ${zone.walkable} m²`);
});

void test('a click on the hero where the rock hid him lands within reach of him in every zone once the window opens, not on the shelf in front', (): void => {
  assert.ok(swept.reduce((sum: number, zone: ZoneSweep): number => sum + zone.missedBefore, 0) > 0);
  for (const zone of swept) assert.deepEqual(zone.missed, [], `${zone.zone}: a click on the hero lands away from him at ${zone.missed.slice(0, 12).join(' ')} of ${zone.walkable} m²`);
});

void test('the sweep report passes the live zones and fails, listing the floor, when any square metre stays hidden', (): void => {
  assert.equal(sweepFailed(swept), false);
  assert.match(sweepLines(swept).at(-1) ?? '', /^PASS/);
  const broken: ZoneSweep[] = [{ zone: 'test', walkable: 4, hidden: 2, cutHidden: ['1.5,2.5'], missedBefore: 1, missed: [] }];
  assert.equal(sweepFailed(broken), true);
  const lines: string[] = sweepLines(broken);
  assert.ok(lines.includes('test | 4 | 2 | 1 | 1 | 0'));
  assert.ok(lines.includes('  hidden with window at 1.5,2.5'));
  assert.match(lines.at(-1) ?? '', /^FAIL/);
});
