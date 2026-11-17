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
import { generateItem, itemLines, itemMods, moyuAffixStrength } from '../items.ts';
import { createRng } from '../rng.ts';
import { handleTrade, meetNpc, sellPrice } from '../world/trade.ts';
import { earthGuard, elementPower, goldStrike, legendaryEarthGuard, legendaryFireKill, legendaryGoldGuard, legendaryWoodHit, startElementSkill, stepMoyuElements, woodStrike } from '../world/moyu-elements.ts';
import { moyuSpecialOf } from '../moyu-specials.ts';
import { readLedgerItem } from '../../src/backend/ledger-read.ts';
import { moyuComboDamage, moyuComboHit } from '../world/moyu-combos.ts';

const points = (element: string, count: number): string[] => Array.from({ length: count }, (_: unknown, index: number): string => `base-${element}-${index + 1}`);

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
  assert.equal(moyuRequirements(['base-金-1', 'base-木-1'], 'word-流血'), false);
  assert.equal(moyuRequirements([...points('金', 3), 'base-木-1'], 'word-流血'), true);
  assert.equal(canAllocate(content, [...points('金', 3), 'base-土-1'], 1, 'word-破甲'), true);
  assert.equal(hotWeapon('armament-手枪-快膛'), true);
  assert.equal(canAllocate(content, [], 1, 'armament-手枪-快膛'), false);
  assert.equal(moyuRequirements(['gate-金'], 'socket-金木'), false);
  assert.equal(content.skillTree.some((node) => node.id.startsWith('weapon-') || node.id.startsWith('hybrid-')), false);
  assert.equal(content.skillTree.every((node) => node.skillMods.length === 0), true);
  const base = must(content.skills.get('cleave'), 'cleave');
  const boosted = resolveSkill(content, base, ['word-流血']);
  assert.equal(boosted.damage.weaponPercent, base.damage.weaponPercent);
  assert.equal(boosted.lifeOnHit, base.lifeOnHit);
  const sword = must(content.itemBases.get('rusted_blade'), 'sword');
  const armed = resolveSkill(content, base, ['word-流血'], [], sword.variants, 'blade');
  assert.equal(armed.name, '突刺');
  assert.equal(armed.delivery.type, 'arc');
  assert.equal(armed.damage.weaponPercent, base.damage.weaponPercent);
  const second = resolveSkill(content, must(content.skills.get('thunderclap'), 'thunderclap'), ['word-流血'], [], sword.variants, 'blade');
  assert.equal(armed.moyuCombo, 'word-流血');
  assert.equal(second.moyuCombo, 'word-流血');
  assert.notEqual(armed.name, second.name);
  assert.notEqual(armed.vfx.color, resolveSkill(content, base, ['word-破甲'], [], sword.variants, 'blade').vfx.color);
});

void test('base points use combat mechanics rather than generic skill bonuses and every mix has a distinct color', (): void => {
  const content = moyuContent(loadContent());
  const base = must(content.skills.get('cleave'), 'cleave');
  const gold = resolveSkill(content, base, ['base-金-1']);
  assert.equal(gold.damage.weaponPercent, base.damage.weaponPercent);
  assert.equal(gold.vfx.color, base.vfx.color);
  assert.equal(gold.moyuCombo, undefined);
  const elements = ['金', '木', '水', '火', '土'];
  const combinations = content.skillTree.filter((node) => node.id.startsWith('word-'));
  const colors = new Map<string, string>();
  for (const node of combinations) {
    const effect = must(moyuSkillEffect([node.id]), node.id);
    colors.set(effect.label, effect.color);
    assert.equal(resolveSkill(content, base, [node.id]).vfx.color, effect.color);
  }
  assert.equal(new Set(colors.values()).size, colors.size);
  assert.equal(new Set(combinations.map((node): string => must(moyuSkillEffect([node.id]), node.id).color)).size, combinations.length);
  for (const element of elements) {
    const effect = must(moyuSkillEffect([`base-${element}-1`]), element);
    assert.equal(effect.count, 1);
    assert.equal(colors.has(effect.label), false);
  }
  assert.equal(resolveSkill(content, base, ['synergy-血芽']).vfx.color, base.vfx.color);
});

void test('each weapon action can keep a different unlocked combination through a save', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 32, save: null, opening: false });
  world.player.allocated = [...points('金', 3), 'base-木-1', 'base-土-1', 'word-流血', 'word-破甲'];
  world.player.changes = {};
  const first = must(content.skills.get('cleave'), 'first');
  const second = must(content.skills.get('thunderclap'), 'second');
  const sword = must(content.itemBases.get('rusted_blade'), 'sword');
  const original = resolveSkill(content, first, world.player.allocated, [], sword.variants, 'blade', world.player.changes);
  assert.equal(original.moyuCombo, 'word-流血');
  stepWorld(world, [{ type: 'moyu_bind', skill: 'cleave', combo: 'word-破甲' }, { type: 'moyu_bind', skill: 'thunderclap', combo: 'word-流血' }], 1 / 30);
  const slash = resolveSkill(content, first, world.player.allocated, [], sword.variants, 'blade', world.player.changes);
  const sweep = resolveSkill(content, second, world.player.allocated, [], sword.variants, 'blade', world.player.changes);
  assert.equal(slash.moyuCombo, 'word-破甲');
  assert.equal(sweep.moyuCombo, 'word-流血');
  assert.notEqual(slash.vfx.color, sweep.vfx.color);
  assert.notEqual(sweep.burn, null);
  world.player.level = 10;
  const restored = readSave(content, toSave(world));
  assert.equal(restored?.changes['moyu:cleave'], 'word-破甲');
  assert.equal(restored.changes['moyu:thunderclap'], 'word-流血');
});

void test('equipped combinations change combat timing and target control', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 33, save: null, opening: false });
  const target = spawnMonster(world, must(content.monsters.get('wolf'), 'wolf'), world.nextPackId, { x: world.player.pos.x + 2, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: 1 });
  const base = must(content.skills.get('cleave'), 'cleave');
  const frost = resolveSkill(content, base, ['word-冰封']);
  moyuComboHit(world, target, frost);
  moyuComboHit(world, target, frost);
  assert.equal(target.tempo, 1);
  moyuComboHit(world, target, frost);
  assert.equal(target.tempo, 0);
  assert.equal(target.tempoTime > 0, true);
  const guard = resolveSkill(content, base, ['word-破甲']);
  assert.equal(moyuComboDamage(world, guard, true) > 1, true);
  assert.equal(moyuComboDamage(world, guard, false), 1);
});

void test('sword actions gain their own combination interactions', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 34, save: null, opening: false });
  const target = spawnMonster(world, must(content.monsters.get('wolf'), 'wolf'), world.nextPackId, { x: world.player.pos.x + 2, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: 1 });
  const sword = must(content.itemBases.get('rusted_blade'), 'sword');
  const combo = ['word-锋锐', 'word-净化'];
  const slash = resolveSkill(content, must(content.skills.get('thunderclap'), 'slash'), combo, [], sword.variants, sword.weaponKind, { 'moyu:thunderclap': 'word-锋锐' });
  const counter = resolveSkill(content, must(content.skills.get('storm_bolt'), 'counter'), combo, [], sword.variants, sword.weaponKind, { 'moyu:storm_bolt': 'word-净化' });
  assert.equal(slash.name, '连斩');
  assert.equal(counter.name, '格挡反击');
  assert.ok(moyuComboDamage(world, slash, false, 0.35) > moyuComboDamage(world, slash, false, 0));
  world.player.life = world.player.maxLife * 0.5;
  world.player.cooldowns[counter.id] = 2;
  const before = world.player.life;
  moyuComboHit(world, target, counter, true);
  assert.ok(world.player.life > before);
  assert.ok((world.player.cooldowns[counter.id] ?? 2) < 2);
});

void test('five elements activate at three points and each changes a different combat event', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 23, save: null, opening: false });
  const player = world.player;
  const target = spawnMonster(world, must(content.monsters.get('moyu_boss_under_hall'), 'boss'), world.nextPackId, { x: player.pos.x + 2, z: player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: 1 });
  player.allocated = points('金', 2);
  assert.equal(elementPower(world, '金'), 0);
  player.allocated = points('金', 3);
  assert.equal(goldStrike(world, target), 0);
  assert.equal(goldStrike(world, target), 0);
  assert.ok(goldStrike(world, target) > 0);

  player.allocated = points('木', 3);
  player.life = player.maxLife - 20;
  woodStrike(world);
  woodStrike(world);
  assert.equal(player.life, player.maxLife - 20);
  woodStrike(world);
  assert.ok(player.life > player.maxLife - 20);

  const first = must(content.skills.get('cleave'), 'first skill');
  const second = must(content.skills.get('thunderclap'), 'second skill');
  player.allocated = points('水', 3);
  player.mana = 20;
  player.cooldowns[second.id] = second.cooldown;
  startElementSkill(world, player, first);
  assert.equal(player.mana, 20);
  startElementSkill(world, player, second);
  assert.notEqual(player.mana, 20);
  assert.ok((player.cooldowns[second.id] ?? Infinity) < second.cooldown);

  player.allocated = points('火', 3);
  assert.equal(startElementSkill(world, player, first), 1);
  assert.equal(startElementSkill(world, player, first), 1);
  assert.ok(startElementSkill(world, player, first) < 1);

  player.allocated = points('土', 3);
  startElementSkill(world, player, first);
  assert.ok(earthGuard(world) < 1);
  assert.equal(earthGuard(world), 1);
  startElementSkill(world, player, first);
  player.moving = true;
  stepMoyuElements(world, 2);
  assert.equal(earthGuard(world), 1);
});

void test('element equipment strengthens only its matching unlocked mechanic', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 24, save: null, opening: false });
  const item = { ...must(generateItem(content, createRng(24), 900, 1, 'rusted_blade', 'common'), 'sword'), affixes: [{ affix: 'moyu_金', value: 0.05 }] };
  world.player.equipped.weapon = item;
  world.player.allocated = ['base-金-1', 'base-金-2'];
  assert.equal(elementPower(world, '金'), 0);
  world.player.allocated.push('base-金-3');
  assert.ok(elementPower(world, '金') > 1);
  assert.equal(elementPower(world, '木'), 0);
  assert.equal(itemMods(content, item).some((mod) => mod.stat === 'damagePercent'), false);
  assert.equal(moyuAffixStrength('moyu_木', 0.5), 0.05);
  assert.equal(moyuAffixStrength('moyu_土', 5), 0.05);
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
    const special = moyuSpecialOf(item);
    if (rarity.id === 'stormtouched') {
      assert.notEqual(special, null);
      assert.ok(item.affixes.some((affix): boolean => affix.affix === `moyu_${special}`));
      assert.equal(itemLines(content, item).filter((line): boolean => line.source === 'special').length, 1);
    } else assert.equal(special, null);
  }
});

void test('legendary special survives a save and old legendary equipment gains a stable special', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 42, save: null, opening: false });
  const item = must(generateItem(content, createRng(42), 910, 5, 'rusted_blade', 'stormtouched'), 'legendary');
  world.player.equipped.weapon = item;
  const saved = must(readSave(content, toSave(world)), 'saved game');
  assert.equal(moyuSpecialOf(must(saved.equipped.weapon, 'restored weapon')), moyuSpecialOf(item));
  const minted = must(readLedgerItem(content, { id: `itm_${'A'.repeat(22)}`, base: item.base, rarity: item.rarity, level: item.level, affixes: item.affixes, special: item.special }), 'minted equipment');
  assert.equal(moyuSpecialOf(minted), moyuSpecialOf(item));
  const old = { base: item.base, rarity: item.rarity, level: item.level, affixes: item.affixes };
  assert.equal(moyuSpecialOf(old), moyuSpecialOf({ ...old }));
  assert.notEqual(moyuSpecialOf(old), null);
});

void test('legendary combat effects trigger separately and gain power from matching points', (): void => {
  const content = moyuContent(loadContent());
  const world = createWorld(content, { seed: 43, save: null, opening: false });
  const player = world.player;
  const item = must(generateItem(content, createRng(43), 911, 5, 'rusted_blade', 'stormtouched'), 'legendary');
  const target = spawnMonster(world, must(content.monsters.get('moyu_boss_under_hall'), 'boss'), world.nextPackId, { x: player.pos.x + 2, z: player.pos.z }, { summonerId: null, scatter: 0, revived: false, level: 1 });
  player.equipped.weapon = { ...item, special: '金' };
  player.mana = 10;
  legendaryGoldGuard(world, target);
  assert.equal(player.mana, 12);
  legendaryGoldGuard(world, target);
  assert.equal(player.mana, 12);
  player.allocated = points('金', 3);
  world.time += 3;
  legendaryGoldGuard(world, target);
  assert.equal(player.mana, 14.5);

  player.equipped.weapon = { ...item, special: '木' };
  player.life = player.maxLife * 0.4;
  const low = player.life;
  legendaryWoodHit(world);
  assert.ok(player.life > low);
  player.equipped.weapon = { ...item, special: '火' };
  player.mana = 10;
  legendaryFireKill(world);
  assert.equal(player.mana, 14);
  player.equipped.weapon = { ...item, special: '土' };
  player.moving = false;
  assert.equal(legendaryEarthGuard(world), 0.88);
  player.equipped.weapon = { ...item, special: '水' };
  player.mana = 10;
  startElementSkill(world, player, must(content.skills.get('cleave'), 'cleave'));
  startElementSkill(world, player, must(content.skills.get('thunderclap'), 'thunderclap'));
  assert.equal(player.mana, 12);
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
