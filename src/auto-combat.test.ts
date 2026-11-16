import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from '../sim/content/content.ts';
import type { Content } from '../sim/content/types.ts';
import { monsterLevel, spawnMonster } from '../sim/world/spawn.ts';
import type { MonsterState, World } from '../sim/world/types.ts';
import { armed, must, worldIn } from '../test/support.ts';
import { createAutoCombatState, planAutoCombat } from './auto-combat-plan.ts';
import { moyuContent } from '../sim/content/moyu.ts';
import type { AutoCombatState } from './auto-combat-plan.ts';

const content: Content = loadContent();

function scene(): { world: World; state: AutoCombatState; target: MonsterState } {
  const world: World = armed(worldIn(content, 'hall_of_time', 7));
  const target: MonsterState = spawnMonster(world, must(content.monsters.get('wolf'), 'wolf'), world.nextPackId, { x: world.player.pos.x + 3, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: monsterLevel(world) });
  world.monsters = [target];
  const state: AutoCombatState = createAutoCombatState(world.zone.id);
  state.enabled = true;
  return { world, state, target };
}

void test('auto combat selects a nearby hostile target with the main attack', (): void => {
  const { world, state, target } = scene();
  const commands = planAutoCombat(world, state, 1 / 30, [], false);
  assert.deepEqual(commands, [{ type: 'skill', slot: 0, aim: target.pos, targetId: target.id }]);
});

void test('auto combat leaves farming bosses for manual play', (): void => {
  const portal = moyuContent(content);
  const world: World = armed(worldIn(portal, 'hall_of_time', 7));
  const def = must(portal.monsters.get('moyu_boss_hall_of_time'), 'boss');
  const boss = spawnMonster(world, def, world.nextPackId, { x: world.player.pos.x + 3, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: monsterLevel(world) });
  world.monsters = [boss];
  const state = createAutoCombatState(world.zone.id);
  state.enabled = true;
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), []);
});

void test('manual movement takes priority and pauses automatic attacks', (): void => {
  const { world, state } = scene();
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [{ type: 'move', held: false, dest: world.player.pos }], false), []);
  assert.deepEqual(planAutoCombat(world, state, 0.5, [], false), []);
  assert.equal(planAutoCombat(world, state, 0.4, [], false).length, 1);
});

void test('auto chase stops at the leash and never starts while a panel covers play', (): void => {
  const { world, state, target } = scene();
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], true), []);
  planAutoCombat(world, state, 1 / 30, [], false);
  world.player.intent = { type: 'attack', slot: 0, targetId: target.id };
  world.player.pos = { x: world.player.pos.x + 11, z: world.player.pos.z };
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), [{ type: 'stop' }]);
  world.player.intent = { type: 'idle' };
  assert.deepEqual(planAutoCombat(world, state, 1, [], false), []);
});
