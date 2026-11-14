import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../content/content.ts';
import type { MonsterScaling } from '../content/types.ts';
import { monsterScale } from './monster-scale.ts';
import type { MonsterScale } from './monster-scale.ts';

const shipped: MonsterScaling = loadContent().world.scaling;

const TODAY = { lifePerLevel: 0.3, damagePerLevel: 0.28, lastLevel: 5 } as const;
const STEEP = { lifePerLevel: 1.2, damagePerLevel: 1.12, firstLevel: 10, lastLevel: 30 } as const;

void test('monsters up to level 5 are exactly as tough as before the ramp', (): void => {
  for (let level: number = 1; level <= TODAY.lastLevel; level += 1) {
    assert.deepEqual(monsterScale(shipped, level), { life: 1 + TODAY.lifePerLevel * (level - 1), damage: 1 + TODAY.damagePerLevel * (level - 1) });
  }
});

void test('from level 10 on monsters grow at the steep slopes exactly', (): void => {
  for (let level: number = STEEP.firstLevel; level <= STEEP.lastLevel; level += 1) {
    assert.deepEqual(monsterScale(shipped, level), { life: 1 + STEEP.lifePerLevel * (level - 1), damage: 1 + STEEP.damagePerLevel * (level - 1) });
  }
});

void test('between the ends of the ramp toughness rises every level and stays between the two slopes', (): void => {
  let previous: MonsterScale = monsterScale(shipped, 1);
  for (let level: number = 2; level <= STEEP.lastLevel; level += 1) {
    const scale: MonsterScale = monsterScale(shipped, level);
    assert.ok(scale.life > previous.life && scale.damage > previous.damage, `level ${level}`);
    assert.ok(scale.life >= 1 + TODAY.lifePerLevel * (level - 1) && scale.life <= 1 + STEEP.lifePerLevel * (level - 1), `level ${level}`);
    previous = scale;
  }
});

void test('without a ramp the slopes are flat at every level', (): void => {
  const flat: MonsterScaling = { lifePerLevel: 0.5, damagePerLevel: 0.25, xpPerLevel: 0.1, ramp: null };
  assert.deepEqual(monsterScale(flat, 21), { life: 11, damage: 6 });
});
