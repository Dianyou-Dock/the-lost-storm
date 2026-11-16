import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from './content.ts';
import { hotWeapon, isMoyu, MOYU_MAPS, moyuContent, moyuRequirements } from './moyu.ts';
import { createWorld } from '../world/create.ts';
import { stepWorld } from '../world/step.ts';
import { canAllocate } from '../progression.ts';
import { toSave } from '../save.ts';

void test('portal content uses the five element chart without quests', (): void => {
  const content = moyuContent(loadContent());
  assert.equal(isMoyu(content), true);
  assert.equal(content.quests.size, 0);
  assert.equal(content.skillTree.length, 424);
  assert.equal(content.chart.pointsPerLevel, 1);
  assert.equal(content.player.xp.maxLevel, 41);
  assert.equal(content.chart.grants.reduce((sum, grant): number => sum + grant.points, 0), 10);
  assert.equal(content.zones.get('ledger_hall')?.packs.every((pack): boolean => pack.level === undefined), true);
  assert.equal(content.zones.get('ledger_hall')?.levelUpTo, 41);
});

void test('a random map begins a fresh combat run and can be entered again', (): void => {
  const world = createWorld(moyuContent(loadContent()), { seed: 7, save: null, opening: false });
  assert.equal(world.zone.id, 'hideout');
  const first = stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  assert.equal(MOYU_MAPS.includes(world.zone.id), true);
  assert.equal(world.zone.level <= 3, true);
  assert.equal(first.some((event): boolean => event.type === 'zone_changed'), true);
  const previous = world.zone.id;
  const second = stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  assert.notEqual(world.zone.id, previous);
  assert.equal(second.some((event): boolean => event.type === 'zone_changed'), true);
});

void test('an old low-level save in a high-level map returns to the hideout', (): void => {
  const content = moyuContent(loadContent());
  const fresh = createWorld(content, { seed: 5, save: null, opening: false });
  const save = { ...toSave(fresh), zone: 'under_hall_2' };
  const restored = createWorld(content, { seed: 5, save, opening: false });
  assert.equal(restored.zone.id, 'hideout');
});

void test('cold routes can start while hot weapons and unimplemented sockets cannot spend points', (): void => {
  const content = moyuContent(loadContent());
  assert.equal(canAllocate(content, [], 1, 'base-金-1'), true);
  assert.equal(hotWeapon('armament-手枪-快膛'), true);
  assert.equal(canAllocate(content, [], 1, 'armament-手枪-快膛'), false);
  assert.equal(moyuRequirements(['gate-金'], 'socket-金木'), false);
});
