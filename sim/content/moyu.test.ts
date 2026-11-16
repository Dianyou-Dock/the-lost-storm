import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from './content.ts';
import { hotWeapon, isMoyu, MOYU_MAPS, moyuContent, moyuRequirements, moyuSkillEffect } from './moyu.ts';
import { createWorld } from '../world/create.ts';
import { stepWorld } from '../world/step.ts';
import { canAllocate } from '../progression.ts';
import { readSave, toSave } from '../save.ts';
import { monsterLevel, spawnMonster } from '../world/spawn.ts';
import { must } from '../../test/support.ts';
import { resolveSkill } from '../stats.ts';
import { applyHit, offenceOf } from '../world/combat.ts';
import { addToInventory } from '../world/character.ts';
import { generateItem } from '../items.ts';
import { createRng } from '../rng.ts';
import { handleTrade, meetNpc, sellPrice } from '../world/trade.ts';

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
  const home = stepWorld(world, [{ type: 'return_home' }], 1 / 30);
  assert.equal(world.zone.id, 'hideout');
  assert.equal(home.some((event): boolean => event.type === 'zone_changed' && event.to === 'hideout'), true);
});

void test('an old low-level save in a high-level map returns to the hideout', (): void => {
  const content = moyuContent(loadContent());
  const fresh = createWorld(content, { seed: 5, save: null, opening: false });
  const save = { ...toSave(fresh), zone: 'under_hall_3' };
  const restored = createWorld(content, { seed: 5, save, opening: false });
  assert.equal(restored.zone.id, 'hideout');
});

void test('the hideout merchant sells all sellable bag items in one action', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 5, save: null, opening: false });
  const vendor = must(world.npcs.find((npc): boolean => npc.def.service === 'vendor'), 'hideout vendor');
  world.player.pos = { x: vendor.pos.x + 1, z: vendor.pos.z };
  meetNpc(world, vendor);
  const item = must(generateItem(content, createRng(9), 123, 1, 'rusted_blade', 'common'), 'blade');
  world.player.inventory[0] = item;
  world.player.gold = 0;
  handleTrade(world, { type: 'sell_all' });
  assert.equal(world.player.inventory[0], null);
  assert.equal(world.player.gold, sellPrice(content, item));
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
  assert.equal(armed.name, '突刺');
  assert.equal(armed.delivery.type, 'arc');
  assert.equal(armed.damage.weaponPercent > base.damage.weaponPercent, true);
  const second = resolveSkill(content, must(content.skills.get('thunderclap'), 'thunderclap'), ['word-流血'], [], sword.variants, 'blade');
  assert.notEqual(armed.vfx.style, second.vfx.style);
  assert.notEqual(armed.vfx.color, resolveSkill(content, base, ['word-破甲'], [], sword.variants, 'blade').vfx.color);
});

void test('base points affect skills and every element mix has a stable distinct color', (): void => {
  const content = moyuContent(loadContent());
  const base = must(content.skills.get('cleave'), 'cleave');
  const gold = resolveSkill(content, base, ['base-金-1']);
  assert.equal(gold.damage.weaponPercent > base.damage.weaponPercent, true);
  assert.equal(gold.vfx.color, moyuSkillEffect(['base-金-1'])?.color);
  const elements = ['金', '木', '水', '火', '土'];
  const combinations = content.skillTree.filter((node) => node.id.startsWith('word-') || node.id.startsWith('confluence-'));
  const colors = new Map<string, string>();
  for (const node of combinations) {
    const effect = must(moyuSkillEffect([node.id]), node.id);
    colors.set(effect.label, effect.color);
    assert.equal(resolveSkill(content, base, [node.id]).vfx.color, effect.color);
  }
  assert.equal(new Set(colors.values()).size, colors.size);
  for (const element of elements) {
    const effect = must(moyuSkillEffect([`base-${element}-1`]), element);
    assert.equal(effect.count, 1);
    assert.equal(colors.has(effect.label), false);
  }
  assert.equal(resolveSkill(content, base, ['synergy-血芽']).vfx.color, moyuSkillEffect(['synergy-血芽'])?.color);
});

void test('the five element chart groups basic paths, two element effects and three element effects into clear rings', (): void => {
  const nodes = moyuContent(loadContent()).skillTree;
  const radius = (node: typeof nodes[number]): number => Math.hypot(node.column, node.row) * 72;
  const bases = nodes.filter((node) => node.id.startsWith('base-'));
  const pairs = nodes.filter((node) => node.id.startsWith('word-') || node.id.startsWith('synergy-'));
  const triples = nodes.filter((node) => node.id.startsWith('variant-') || node.id.startsWith('confluence-'));
  assert.equal(Math.max(...bases.map(radius)) < Math.min(...pairs.map(radius)), true);
  assert.equal(Math.max(...pairs.map(radius)) < Math.min(...triples.map(radius)), true);
  let closest: number = Number.POSITIVE_INFINITY;
  for (const [index, node] of nodes.entries()) for (const other of nodes.slice(index + 1)) closest = Math.min(closest, Math.hypot(node.column - other.column, node.row - other.row) * 72);
  assert.equal(closest >= 60, true);
});

void test('farming equipment has five exact random affix tiers and respec is free', (): void => {
  const content = moyuContent(loadContent());
  assert.deepEqual(content.rarities.map((rarity) => [rarity.name, rarity.affixMin, rarity.affixMax]), [['普通', 1, 1], ['精良', 2, 2], ['优秀', 3, 3], ['史诗', 4, 4], ['传说', 5, 5]]);
  assert.equal(content.chart.respec.goldPerPoint, 0);
  assert.equal(content.chart.respec.goldPerLevel, 0);
  for (const [count, rarity] of content.rarities.entries()) {
    const item = must(generateItem(content, createRng(400 + count), count, 5, 'rusted_blade', rarity.id), rarity.id);
    assert.equal(item.affixes.length, count + 1);
    assert.equal(new Set(item.affixes.map((affix) => affix.affix)).size, count + 1);
  }
});

void test('ordinary map monsters cannot finish the player while boss damage remains lethal', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 19, save: null, opening: false });
  const ordinary = spawnMonster(world, must(content.monsters.get('wolf'), 'wolf'), world.nextPackId, { x: world.player.pos.x + 2, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: 1 });
  world.player.life = 1;
  applyHit(world, offenceOf(ordinary), world.player, must(content.skills.get(ordinary.def.skill), 'monster skill'), { x: 1, z: 0 });
  assert.equal(world.player.life, 1);
  const boss = spawnMonster(world, must(content.monsters.get('moyu_boss_under_hall'), 'boss'), world.nextPackId + 1, { x: world.player.pos.x + 2, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: 1 });
  applyHit(world, offenceOf(boss), world.player, must(content.skills.get(boss.def.skill), 'boss skill'), { x: 1, z: 0 });
  assert.equal(world.player.alive, false);
});

void test('all five documented cold weapons bind their three matching actions', (): void => {
  const content = moyuContent(loadContent());
  const base = must(content.skills.get('cleave'), 'cleave');
  const expected = [
    ['tidecut_sabre', ['斩', '横扫', '重斩']],
    ['rusted_blade', ['突刺', '连斩', '格挡反击']],
    ['tempest_greatsword', ['突刺', '连斩', '格挡反击']],
    ['woodsman_hatchet', ['劈砍', '旋斩', '断势']],
    ['driftwood_staff', ['点', '扫', '砸']],
    ['skinning_knife', ['刺', '连刺', '背袭']],
  ] as const;
  for (const [id, names] of expected) {
    const weapon = must(content.itemBases.get(id), id);
    const actual = ['cleave', 'thunderclap', 'storm_bolt'].map((skill) => resolveSkill(content, must(content.skills.get(skill), skill), [], [], weapon.variants, weapon.weaponKind).name);
    assert.deepEqual(actual, names, id);
  }
  assert.equal(base.name, 'Cleave');
});

void test('expanded moyu bag and stash survive a save round trip', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 13, save: null, opening: false });
  const item = must(generateItem(content, createRng(9), 700, 1, 'rusted_blade', 'common'), 'item');
  world.player.inventory.forEach((_, index): void => { world.player.inventory[index] = { ...item, uid: 800 + index }; });
  assert.equal(addToInventory(world.player, { ...item, uid: 701 }, true), true);
  world.stash.push({ ...item, uid: 702 });
  const saved = readSave(content, toSave(world));
  assert.ok(saved);
  assert.equal(saved.inventory.length, content.player.inventorySize + 1);
  assert.equal(saved.stash.length, content.trade.stashSize + 1);
});
