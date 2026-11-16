import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from './content.ts';
import { hotWeapon, isMoyu, MOYU_MAPS, moyuContent, moyuRequirements } from './moyu.ts';
import { createWorld } from '../world/create.ts';
import { stepWorld } from '../world/step.ts';
import { canAllocate } from '../progression.ts';
import { readSave, toSave } from '../save.ts';
import { monsterLevel, spawnMonster } from '../world/spawn.ts';
import { must } from '../../test/support.ts';
import { resolveSkill } from '../stats.ts';

void test('portal content uses the five element chart without quests', (): void => {
  const content = moyuContent(loadContent());
  assert.equal(isMoyu(content), true);
  assert.equal(content.quests.size, 0);
  assert.equal(content.skillTree.length, 155);
  assert.equal(content.chart.pointsPerLevel, 1);
  assert.equal(content.player.xp.maxLevel, 41);
  assert.equal(content.chart.grants.reduce((sum, grant): number => sum + grant.points, 0), 10);
  assert.equal(content.zones.get('ledger_hall')?.packs.every((pack): boolean => pack.level === undefined), true);
  assert.equal(content.zones.get('ledger_hall')?.levelUpTo, 41);
  assert.equal(content.player.skillBook.filter((entry) => entry.level === 1).length, 4);
  assert.equal(content.player.skillBar.slice(0, 4).every((entry) => entry.skill !== null), true);
  for (const id of MOYU_MAPS) {
    const zone = must(content.zones.get(id), id);
    assert.equal(zone.tiles.length >= 80, true);
    assert.equal(zone.exits.some((exit) => exit.to === 'hideout'), true);
    assert.equal(zone.exits.some((exit) => MOYU_MAPS.includes(exit.to)), true);
    assert.equal(zone.packs.length >= 19, true);
    assert.equal(zone.packs.some((pack) => pack.members.length > 1), true);
  }
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
  const save = { ...toSave(fresh), zone: 'under_hall_3' };
  const restored = createWorld(content, { seed: 5, save, opening: false });
  assert.equal(restored.zone.id, 'hideout');
});

void test('an older portal save receives the newly available weapon actions', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 5, save: null, opening: false });
  const old = { ...toSave(world), treeRevision: content.chart.revision - 1, bar: ['cleave', null, null, null, null, null] };
  const restored = readSave(content, old);
  assert.equal(restored?.bar.slice(0, 4).every((skill) => skill !== null), true);
});

void test('every farming map has one scaled boss with a modest guaranteed drop', (): void => {
  const content = moyuContent(loadContent());
  for (const id of MOYU_MAPS) {
    const zone = must(content.zones.get(id), id);
    const bossPacks = zone.packs.filter((pack) => pack.members.some((member) => content.monsters.get(member.monster)?.boss !== null));
    assert.equal(bossPacks.length, 1, id);
    const pack = must(bossPacks[0], 'boss pack');
    const member = must(pack.members[0], 'boss member');
    const def = must(content.monsters.get(member.monster), 'boss');
    const boss = must(def.boss, 'boss properties');
    assert.equal(boss.drop.items, 1);
    assert.equal(boss.drop.rarity, 'magic');
    assert.equal(boss.firstKill, null);
    assert.equal(pack.when.some((condition) => condition.type === 'flag' && condition.flag === `moyu_boss_${id}_active`), true);
    assert.equal(zone.npcs.some((npc) => npc.npc === `moyu_challenger_${id}`), true);
  }
  const world = createWorld(content, { seed: 13, save: null, opening: false });
  stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  const def = must(content.monsters.get(`moyu_boss_${world.zone.id}`), 'boss');
  const boss = spawnMonster(world, def, world.nextPackId, world.player.pos, { summonerId: null, scatter: 0, revived: false, level: monsterLevel(world) });
  assert.equal(boss.maxLife, Math.round(world.player.maxLife * 2.4));
  assert.equal(boss.damageMax, world.player.maxLife * 0.19);
});

void test('a map boss waits for the challenger conversation before spawning', (): void => {
  const world = createWorld(moyuContent(loadContent()), { seed: 21, save: null, opening: false });
  stepWorld(world, [{ type: 'random_map' }], 1 / 30);
  const bossId = `moyu_boss_${world.zone.id}`;
  const challenger = must(world.npcs.find((npc) => npc.def.id === `moyu_challenger_${world.zone.id}`), 'challenger');
  assert.equal(world.monsters.some((monster) => monster.def.id === bossId), false);
  world.player.pos = { ...challenger.pos };
  stepWorld(world, [{ type: 'talk', npcId: challenger.id }], 1 / 30);
  assert.equal(world.monsters.some((monster) => monster.def.id === bossId), false);
  assert.equal(world.dialogue?.talk.id, `${challenger.def.id}_challenge`);
  stepWorld(world, [{ type: 'advance' }], 1 / 30);
  assert.equal(world.monsters.filter((monster) => monster.def.id === bossId).length, 1);
  assert.equal(world.npcs.some((npc) => npc.id === challenger.id), false);
});

void test('the chart contains only basic paths and two or three element effects', (): void => {
  const content = moyuContent(loadContent());
  assert.equal(canAllocate(content, [], 1, 'base-金-1'), true);
  assert.equal(hotWeapon('armament-手枪-快膛'), true);
  assert.equal(canAllocate(content, [], 1, 'armament-手枪-快膛'), false);
  assert.equal(moyuRequirements(['gate-金'], 'socket-金木'), false);
  assert.equal(content.skillTree.some((node) => node.id.startsWith('weapon-') || node.id.startsWith('hybrid-')), false);
  assert.equal(content.skillTree.some((node) => node.id === 'word-流血' && node.skillMods.length > 0), true);
  const base = must(content.skills.get('cleave'), 'cleave');
  const boosted = resolveSkill(content, base, ['word-流血']);
  assert.equal(boosted.damage.weaponPercent > base.damage.weaponPercent, true);
  assert.equal(boosted.lifeOnHit > base.lifeOnHit, true);
  const sword = must(content.itemBases.get('rusted_blade'), 'sword');
  const armed = resolveSkill(content, base, ['word-流血'], [], sword.variants, 'blade');
  assert.equal(armed.name, '剑刃连斩');
  assert.equal(armed.damage.weaponPercent > base.damage.weaponPercent, true);
});
