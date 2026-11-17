import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from '../sim/content/content.ts';
import type { Content } from '../sim/content/types.ts';
import { monsterLevel, spawnMonster } from '../sim/world/spawn.ts';
import type { MonsterState, World } from '../sim/world/types.ts';
import { armed, must, worldIn } from '../test/support.ts';
import { createAutoCombatState, planAutoCombat } from './auto-combat-plan.ts';
import { moyuContent } from '../sim/content/moyu.ts';
import { createWorld } from '../sim/world/create.ts';
import { stepWorld } from '../sim/world/step.ts';
import { dropOnGround } from '../sim/world/ground.ts';
import type { AutoCombatState } from './auto-combat-plan.ts';
import { setPickupMinimum } from './loot-filter.ts';
import { generateItem } from '../sim/items.ts';
import { createRng } from '../sim/rng.ts';

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
  const world: World = armed(worldIn(portal, 'under_hall', 7));
  const def = must(portal.monsters.get('moyu_boss_under_hall'), 'boss');
  const boss = spawnMonster(world, def, world.nextPackId, { x: world.player.pos.x + 3, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: monsterLevel(world) });
  world.monsters = [boss];
  const state = createAutoCombatState(world.zone.id);
  state.enabled = true;
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), []);
});

void test('moyu auto combat varies ready weapon skills and skips unavailable skills', (): void => {
  const portal = moyuContent(content);
  const world: World = armed(worldIn(portal, 'under_hall', 7));
  const target = spawnMonster(world, must(portal.monsters.get('wolf'), 'wolf'), world.nextPackId, { x: world.player.pos.x + 3, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: monsterLevel(world) });
  world.monsters = [target];
  const state = createAutoCombatState(world.zone.id);
  state.enabled = true;
  state.random = 7;
  const selected = Array.from({ length: 24 }, (): number => {
    const command = planAutoCombat(world, state, 1 / 30, [], false)[0];
    assert.equal(command?.type, 'skill');
    return command.slot;
  });
  assert.equal(new Set(selected).size > 1, true);
  assert.equal(selected.every((slot): boolean => world.player.skills[slot]?.delivery.type !== 'dash'), true);

  const unavailable = must(selected[0], 'selected skill slot');
  const skill = must(world.player.skills[unavailable], 'selected skill');
  world.player.cooldowns[skill.id] = 10;
  for (let index = 0; index < 24; index += 1) {
    const command = planAutoCombat(world, state, 1 / 30, [], false)[0];
    assert.equal(command?.type, 'skill');
    assert.notEqual(command.slot, unavailable);
  }
});

void test('manual movement takes priority and pauses automatic attacks', (): void => {
  const { world, state } = scene();
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [{ type: 'move', held: false, dest: world.player.pos }], false), []);
  assert.deepEqual(planAutoCombat(world, state, 0.5, [], false), []);
  assert.equal(planAutoCombat(world, state, 0.4, [], false).length, 1);
});

void test('auto combat seeks distant monsters and never starts while a panel covers play', (): void => {
  const { world, state, target } = scene();
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], true), []);
  target.pos = { x: world.player.pos.x + 30, z: world.player.pos.z };
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), [{ type: 'skill', slot: 0, aim: target.pos, targetId: target.id }]);
  world.player.intent = { type: 'attack', slot: 0, targetId: target.id };
  world.player.pos = { x: world.player.pos.x + 11, z: world.player.pos.z };
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), []);
});

void test('auto combat crosses terrain levels to find monsters in a large farming map', (): void => {
  const world = createWorld(moyuContent(content), { seed: 7, save: null, opening: false });
  stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  const state = createAutoCombatState(world.zone.id);
  state.enabled = true;
  assert.equal(world.monsters.length > 0, true);
  const commands = planAutoCombat(world, state, 1 / 30, [], false);
  assert.equal(commands[0]?.type, 'skill');
  stepWorld(world, commands, 1 / 30);
  assert.equal(world.player.intent.type, 'attack');
  assert.equal(world.player.path.length > 0, true);
});

void test('moyu auto combat drinks life medicine and picks up drops', (): void => {
  const world = createWorld(moyuContent(content), { seed: 11, save: null, opening: false });
  const state = createAutoCombatState(world.zone.id);
  state.enabled = true;
  world.player.life = world.player.maxLife * 0.4;
  assert.equal(planAutoCombat(world, state, 1 / 30, [], false)[0]?.type, 'flask');
  world.player.life = world.player.maxLife;
  const ground = dropOnGround(world, world.player.pos, { kind: 'gold', amount: 5 });
  assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), [{ type: 'pickup', groundId: ground.id }]);
  const item = must(generateItem(world.content, createRng(4), 94, 1, 'rusted_blade', 'common'), 'common blade');
  world.ground.length = 0;
  dropOnGround(world, world.player.pos, { kind: 'item', item });
  setPickupMinimum(2);
  try {
    assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), []);
    world.ground.length = 0;
    const gold = dropOnGround(world, world.player.pos, { kind: 'gold', amount: 2 });
    assert.deepEqual(planAutoCombat(world, state, 1 / 30, [], false), [{ type: 'pickup', groundId: gold.id }]);
  } finally {
    setPickupMinimum(0);
  }
});
