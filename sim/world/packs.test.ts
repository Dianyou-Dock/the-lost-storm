import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OUTPOST_CONTENT, OUTPOST_ZONE } from '../../test/road-support.ts';
import { must } from '../../test/support.ts';
import type { Content, MonsterDef, ZoneDef, ZonePack } from '../content/types.ts';
import { createWorld } from './create.ts';
import { waiting } from './packs.ts';
import type { PackTimer } from './pack-return.ts';
import { levelSpan } from './spawn.ts';
import { stepWorld } from './step.ts';
import type { MonsterState, World } from './types.ts';
import { enterZone } from './zones.ts';

const STEP = { dt: 0.05 } as const;
const SLEEPERS: ZonePack = { x: 12, z: 12, members: [{ monster: 'mended', count: 3, mods: [] }], when: [], level: 12, waits: { near: 8 } };
const CRIER: ZonePack = { x: 44, z: 12, members: [{ monster: 'crier', count: 1, mods: [] }], when: [], level: 7 };
const RULES = { after: 20, away: 10 } as const;
const DEN: ZoneDef = { ...OUTPOST_ZONE, id: 'den', surge: null, packReturn: RULES, packs: [SLEEPERS, CRIER] };

function crierDef(): MonsterDef {
  const base: MonsterDef = must(OUTPOST_CONTENT.monsters.get('mended'), 'mended');
  return { ...base, id: 'crier', alarm: { reach: 40, cry: 3 } };
}

function denWorld(): World {
  const content: Content = {
    ...OUTPOST_CONTENT,
    monsters: new Map<string, MonsterDef>([...OUTPOST_CONTENT.monsters, ['crier', crierDef()]]),
    zones: new Map<string, ZoneDef>([...OUTPOST_CONTENT.zones, [DEN.id, DEN]]),
  };
  const world: World = createWorld(content, { seed: 4, save: null });
  enterZone(world, DEN, { type: 'start' });
  world.player.invulnerable = 1e9;
  world.events = [];
  return world;
}

function packOf(world: World, pack: ZonePack): MonsterState[] {
  const ids: Set<number> = new Set<number>(world.packReturns.filter((timer: PackTimer): boolean => timer.pack === pack).map((timer: PackTimer): number => timer.packId));
  return world.monsters.filter((monster: MonsterState): boolean => monster.alive && ids.has(monster.packId));
}

function run(world: World, seconds: number): void {
  for (let elapsed: number = 0; elapsed < seconds; elapsed += STEP.dt) stepWorld(world, [], STEP.dt);
}

void test('a pack with a level of its own spawns at that level whatever the hero is', (): void => {
  const world: World = denWorld();
  const crier: MonsterState = must(packOf(world, CRIER)[0], 'crier');
  assert.equal(world.player.level, 1);
  assert.equal(crier.level, 7);
  assert.deepEqual(levelSpan(world), { least: 7, most: 12 });
});

void test('a waiting pack is not there until the hero comes near, then it rises already hunting him', (): void => {
  const world: World = denWorld();
  assert.equal(packOf(world, SLEEPERS).length, 0);
  assert.equal(waiting(world, SLEEPERS), true);
  world.player.pos = { x: SLEEPERS.x + 12, z: SLEEPERS.z + 6 };
  run(world, 1);
  assert.equal(packOf(world, SLEEPERS).length, 0);
  world.player.pos = { x: SLEEPERS.x + 6, z: SLEEPERS.z + 2 };
  run(world, STEP.dt);
  const risen: MonsterState[] = packOf(world, SLEEPERS);
  assert.equal(risen.length, 3);
  assert.ok(risen.every((monster: MonsterState): boolean => monster.aggro && monster.spawnTime > 0 && monster.level === 12));
});

void test('a crier that sees the hero runs to the nearest waiting pack and wakes it, far from the hero', (): void => {
  const world: World = denWorld();
  world.player.pos = { x: CRIER.x, z: CRIER.z + 6 };
  const crier: MonsterState = must(packOf(world, CRIER)[0], 'crier');
  let waited: number = 0;
  while (packOf(world, SLEEPERS).length === 0 && waited < 20) {
    run(world, STEP.dt);
    waited += STEP.dt;
  }
  assert.equal(packOf(world, SLEEPERS).length, 3);
  assert.ok(Math.hypot(crier.pos.x - SLEEPERS.x, crier.pos.z - SLEEPERS.z) <= 3.5, `crier at ${crier.pos.x}, ${crier.pos.z}`);
  assert.ok(Math.hypot(world.player.pos.x - SLEEPERS.x, world.player.pos.z - SLEEPERS.z) > 8);
});

void test('a crier cut down before it gets there wakes nobody', (): void => {
  const world: World = denWorld();
  world.player.pos = { x: CRIER.x, z: CRIER.z + 6 };
  run(world, 0.5);
  for (const monster of packOf(world, CRIER)) {
    monster.alive = false;
    monster.life = 0;
  }
  run(world, 20);
  assert.equal(packOf(world, SLEEPERS).length, 0);
  assert.equal(waiting(world, SLEEPERS), true);
});

void test('a woken pack that is cleared comes back asleep, and only wakes again when the hero comes near', (): void => {
  const world: World = denWorld();
  world.player.pos = { x: SLEEPERS.x + 6, z: SLEEPERS.z + 2 };
  run(world, STEP.dt);
  for (const monster of packOf(world, SLEEPERS)) {
    monster.alive = false;
    monster.life = 0;
  }
  world.player.pos = { x: 28, z: 37 };
  run(world, RULES.after + 2);
  assert.equal(packOf(world, SLEEPERS).length, 0);
  assert.equal(waiting(world, SLEEPERS), true);
  world.player.pos = { x: SLEEPERS.x + 6, z: SLEEPERS.z + 2 };
  run(world, STEP.dt);
  assert.equal(packOf(world, SLEEPERS).length, 3);
});
