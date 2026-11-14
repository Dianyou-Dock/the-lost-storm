import assert from 'node:assert/strict';
import { test } from 'node:test';
import world from '../../data/world.json' with { type: 'json' };
import hall from '../../data/zones/hall_of_time.json' with { type: 'json' };
import type { WorldDef, ZoneDef } from './types.ts';
import { worldDef, zone } from './parse-world.ts';

function parsed(change: Readonly<Record<string, unknown>>): ZoneDef {
  return zone({ ...hall, ...change }, 'zone');
}

void test('a zone without a level cap stays at its own level and one with a cap reads it', (): void => {
  const fixed: ZoneDef = parsed({ level: 3, levelUpTo: undefined });
  assert.equal(fixed.levelUpTo, 3);
  assert.equal(parsed({ level: 2, levelUpTo: 9 }).levelUpTo, 9);
});

void test('a zone cannot follow the hero below its own level', (): void => {
  assert.throws((): ZoneDef => parsed({ level: 5, levelUpTo: 4 }), /below its own level/);
});

void test('pack return rules are read when given and absent otherwise', (): void => {
  assert.deepEqual(parsed({ packReturn: { after: 30, away: 12 } }).packReturn, { after: 30, away: 12 });
  assert.equal(parsed({ packReturn: undefined }).packReturn, null);
  assert.throws((): ZoneDef => parsed({ packReturn: { after: 0, away: 12 } }));
});

function withScaling(scaling: Readonly<Record<string, unknown>>): WorldDef {
  return worldDef({ ...world, scaling }, 'world');
}

void test('the monster toughness ramp is read when given, absent means flat, and a ramp that ends where it starts is refused', (): void => {
  const ramp = { from: 5, to: 10, lifePerLevel: 1.2, damagePerLevel: 1.12 };
  const flat = { lifePerLevel: 0.3, damagePerLevel: 0.28, xpPerLevel: 0.15 };
  assert.deepEqual(withScaling({ ...flat, ramp }).scaling.ramp, ramp);
  assert.equal(withScaling(flat).scaling.ramp, null);
  assert.throws((): WorldDef => withScaling({ ...flat, ramp: { ...ramp, to: 5 } }), /world\.scaling\.ramp\.to/);
  assert.throws((): WorldDef => withScaling({ ...flat, ramp: { ...ramp, lifePerLevel: -1 } }), /world\.scaling\.ramp/);
});
