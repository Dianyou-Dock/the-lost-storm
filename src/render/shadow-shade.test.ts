import assert from 'node:assert/strict';
import { test } from 'node:test';
import { armed, must, worldIn } from '../../test/support.ts';
import { loadContent } from '../../sim/content/content.ts';
import type { Content, SkillDef } from '../../sim/content/types.ts';
import { isInvulnerable } from '../../sim/world/dash.ts';
import { startSkill } from '../../sim/world/skills.ts';
import { stepWorld } from '../../sim/world/step.ts';
import type { World } from '../../sim/world/types.ts';
import type { ShadeMotion } from './shadow-shade.ts';
import { shadowOf, stepShade } from './shadow-shade.ts';

const content: Content = loadContent();
const STEP: number = 1 / 60;
const LIMITS = { jump: 0.2, settled: 0.5 } as const;

function rolling(): World {
  const world: World = armed(worldIn(content, content.world.start, 5));
  const roll: SkillDef = must(content.skills.get('dodge_roll'), 'dodge_roll');
  startSkill(world, world.player, roll, { x: 1, z: 0 });
  return world;
}

void test('the dodge roll names its shadow in data and a plain skill has none', (): void => {
  const roll: SkillDef = must(content.skills.get('dodge_roll'), 'dodge_roll');
  assert.ok(roll.vfx.shadow !== null);
  assert.ok(roll.vfx.shadow.strength > 0 && roll.vfx.shadow.strength <= 1);
  const cleave: SkillDef = must(content.skills.get('cleave'), 'cleave');
  assert.equal(cleave.vfx.shadow, null);
});

void test('the hero is a shadow only while the roll keeps the hero from harm', (): void => {
  const world: World = rolling();
  assert.ok(isInvulnerable(world.player));
  assert.notEqual(shadowOf(world.player), null);
  for (let tick: number = 0; tick < 60 && isInvulnerable(world.player); tick += 1) stepWorld(world, [], STEP);
  assert.equal(isInvulnerable(world.player), false);
  assert.equal(shadowOf(world.player), null);
});

void test('the shade eases in and out without a jump and comes to rest', (): void => {
  const motion: ShadeMotion = { value: 0, speed: 0 };
  let last: number = 0;
  for (let tick: number = 0; tick < 15; tick += 1) {
    stepShade(motion, 0.9, STEP);
    assert.ok(motion.value - last < LIMITS.jump, `frame ${String(tick)} jumped ${String(motion.value - last)}`);
    last = motion.value;
  }
  assert.ok(motion.value > LIMITS.settled);
  for (let tick: number = 0; tick < 120; tick += 1) {
    stepShade(motion, 0, STEP);
    assert.ok(last - motion.value < LIMITS.jump);
    assert.ok(motion.value >= 0 && motion.value <= 1);
    last = motion.value;
  }
  assert.equal(motion.value, 0);
  assert.equal(motion.speed, 0);
});
