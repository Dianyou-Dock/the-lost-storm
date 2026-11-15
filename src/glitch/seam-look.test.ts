import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadGlitches } from '../../sim/content/glitches.ts';
import type { SeamPlan } from '../../sim/world/seam.ts';
import { seamAt, seamLength } from '../../sim/world/seam.ts';
import type { SeamLook } from './seam-look.ts';
import { hudTear, portalTear, seamLook } from './seam-look.ts';

const PLAN: SeamPlan = { times: loadGlitches().seam, mist: 2 };
const FRAME: number = 1 / 60;

function looks(soft: boolean): SeamLook[] {
  const list: SeamLook[] = [];
  for (let at: number = 0; at <= seamLength(PLAN) + FRAME; at += FRAME) list.push(seamLook(seamAt(PLAN, at), soft));
  return list;
}

function brightRises(list: readonly SeamLook[]): number {
  let rises: number = 0;
  let high: boolean = false;
  for (const look of list) {
    if (!high && look.white > 0.9) {
      rises += 1;
      high = true;
    } else if (high && look.white < 0.1) high = false;
  }
  return rises;
}

void test('the build-up grows from nothing and the seam ends at rest', (): void => {
  const list: SeamLook[] = looks(false);
  const first: SeamLook = list[0] ?? seamLook(seamAt(PLAN, 0), false);
  assert.ok(first.split < 1e-4 && first.slip < 1e-4 && first.white === 0 && first.tear === 0);
  const last: SeamLook = seamLook(seamAt(PLAN, seamLength(PLAN) + 1), false);
  assert.deepEqual([last.split, last.slip, last.tear, last.blocks, last.white], [0, 0, 0, 0, 0]);
});

void test('white never jumps from one frame to the next, and brightens fully at most twice, seconds apart', (): void => {
  for (const soft of [false, true]) {
    const list: SeamLook[] = looks(soft);
    for (let index: number = 1; index < list.length; index += 1) assert.ok(Math.abs((list[index]?.white ?? 0) - (list[index - 1]?.white ?? 0)) < 0.25, `frame ${index}`);
    assert.ok(brightRises(list) <= 2);
  }
});

void test('the world is swapped only under full white, and the gentle seam never displaces the picture or bands the white', (): void => {
  for (const soft of [false, true]) {
    const list: SeamLook[] = looks(soft);
    for (let index: number = 1; index < list.length; index += 1) {
      const before: SeamLook | undefined = list[index - 1];
      const now: SeamLook | undefined = list[index];
      if (before === undefined || now === undefined || before.swapped === now.swapped) continue;
      assert.ok(Math.max(before.white, now.white) > 0.97, `swap at frame ${index}`);
    }
  }
  for (const look of looks(true)) assert.deepEqual([look.split, look.slip, look.tear, look.blocks, look.banded], [0, 0, 0, 0, false]);
});

void test('the HUD tears with the picture and is still at rest', (): void => {
  const torn = hudTear(seamLook(seamAt(PLAN, PLAN.times.buildUp + PLAN.times.tear / 2), false));
  assert.ok(torn.tear > 0 && torn.split > 0);
  assert.deepEqual(hudTear(seamLook(seamAt(PLAN, 0), false)), { split: 0, tear: 0 });
});

void test('going through a portal tears the screen hard, and only whitens it when glitches are gentle', (): void => {
  const torn: SeamLook = portalTear(false);
  assert.ok(torn.tear > 0 && torn.split > 0 && torn.blocks > 0);
  const gentle: SeamLook = portalTear(true);
  assert.equal(gentle.tear, 0);
  assert.equal(gentle.split, 0);
  assert.ok(gentle.white > 0 && gentle.white < 1);
});
