import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from './content.ts';
import { hotWeapon, isMoyu, MOYU_MAPS, moyuContent, moyuRequirements } from './moyu.ts';
import { createWorld } from '../world/create.ts';
import { stepWorld } from '../world/step.ts';
import { canAllocate } from '../progression.ts';

void test('portal content uses the five element chart without quests', (): void => {
  const content = moyuContent(loadContent());
  assert.equal(isMoyu(content), true);
  assert.equal(content.quests.size, 0);
  assert.equal(content.skillTree.length, 424);
  assert.equal(content.chart.pointsPerLevel, 1);
  assert.equal(content.player.xp.maxLevel, 41);
  assert.equal(content.chart.grants.reduce((sum, grant): number => sum + grant.points, 0), 10);
});

void test('a random map begins a fresh combat run and can be entered again', (): void => {
  const world = createWorld(moyuContent(loadContent()), { seed: 7, save: null, opening: false });
  assert.equal(world.zone.id, 'hideout');
  const first = stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  assert.equal(MOYU_MAPS.includes(world.zone.id), true);
  assert.equal(first.some((event): boolean => event.type === 'zone_changed'), true);
  const previous = world.zone.id;
  const second = stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  assert.notEqual(world.zone.id, previous);
  assert.equal(second.some((event): boolean => event.type === 'zone_changed'), true);
});

void test('cold routes can start while hot weapons and unimplemented sockets cannot spend points', (): void => {
  const content = moyuContent(loadContent());
  assert.equal(canAllocate(content, [], 1, 'base-金-1'), true);
  assert.equal(hotWeapon('armament-手枪-快膛'), true);
  assert.equal(canAllocate(content, [], 1, 'armament-手枪-快膛'), false);
  assert.equal(moyuRequirements(['gate-金'], 'socket-金木'), false);
});
