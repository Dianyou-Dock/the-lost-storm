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

void test('a click aimed at any walkable square metre lands on it in every zone, through the rock in front, inside an open window and with no window', (): void => {
  assert.ok(swept.reduce((sum: number, zone: ZoneSweep): number => sum + zone.bare.before, 0) > 0);
  assert.ok(swept.reduce((sum: number, zone: ZoneSweep): number => sum + zone.inWindow, 0) > 0);
  for (const zone of swept) {
    assert.deepEqual(zone.window.after, [], `${zone.zone}: a click inside the window lands off the floor at ${zone.window.after.slice(0, 12).join(' ')}`);
    assert.deepEqual(zone.bare.after, [], `${zone.zone}: a click with no window lands off the floor at ${zone.bare.after.slice(0, 12).join(' ')}`);
  }
});

void test('the sweep report passes the live zones and fails, listing the floor, when any square metre stays hidden', (): void => {
  assert.equal(sweepFailed(swept), false);
  assert.match(sweepLines(swept).at(-1) ?? '', /^PASS/);
  const clean: ZoneSweep = { zone: 'test', walkable: 4, hidden: 2, cutHidden: [], missedBefore: 1, missed: [], inWindow: 3, window: { before: 2, after: [] }, bare: { before: 3, after: [] } };
  assert.equal(sweepFailed([clean]), false);
  const broken: ZoneSweep[] = [{ ...clean, cutHidden: ['1.5,2.5'] }];
  assert.equal(sweepFailed(broken), true);
  const lines: string[] = sweepLines(broken);
  assert.ok(lines.includes('test | 4 | 2 | 1 | 1 | 0 | 3 | 2 | 0 | 3 | 0'));
  assert.ok(lines.includes('  hidden with window at 1.5,2.5'));
  assert.match(lines.at(-1) ?? '', /^FAIL/);
  assert.equal(sweepFailed([{ ...clean, window: { before: 2, after: ['0.5,0.5'] } }]), true);
  assert.equal(sweepFailed([{ ...clean, bare: { before: 3, after: ['0.5,0.5'] } }]), true);
  assert.ok(sweepLines([{ ...clean, bare: { before: 3, after: ['0.5,0.5'] } }]).includes('  click with no window lands off the floor at 0.5,0.5'));
});
