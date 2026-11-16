import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAT_IDS } from '../../sim/content/types.ts';
import { describeMod, statLabel } from '../../sim/stat-text.ts';
import { localizeText } from './zh.ts';

void test('game terms, keyboard labels and generated status are localized consistently', (): void => {
  assert.equal(localizeText('The Hall of Time'), '时之大厅');
  assert.equal(localizeText('Ladder'), '天梯');
  assert.equal(localizeText('Space'), 'Space');
  assert.equal(localizeText('Level 12 · Man'), '等级 12 · 男性');
  assert.equal(localizeText('Life Flask, 2 of 3 uses'), '生命药剂，剩余 2/3 次');
  assert.equal(localizeText('Played 11 min'), '已游玩 11 分钟');
  assert.equal(localizeText('Last seen in The Hall of Time'), '上次位于时之大厅');
  assert.equal(localizeText('  Inventory  '), '  背包  ');
});

void test('every equipment stat and its signed value has a Chinese label', (): void => {
  for (const stat of STAT_IDS) {
    assert.notEqual(localizeText(statLabel(stat)), statLabel(stat), stat);
    const positive: string = describeMod({ stat, op: 'add', value: 2 });
    const negative: string = describeMod({ stat, op: 'add', value: -2 });
    assert.notEqual(localizeText(positive), positive, positive);
    assert.notEqual(localizeText(negative), negative, negative);
  }
});

void test('equipment level, material, comparison and damage range are localized', (): void => {
  assert.equal(localizeText('Item level 18'), '物品等级 18');
  assert.equal(localizeText('精良 Leather Boots'), '精良 皮甲靴子');
  assert.equal(localizeText('普通 Weapon'), '普通 武器');
  assert.equal(localizeText('−3 average hit'), '−3 平均单次伤害');
  assert.equal(localizeText('+12% toughness'), '+12% 生存');
  assert.equal(localizeText('12–18 Damage'), '12–18 伤害');
  assert.equal(localizeText('Trade'), '交易');
});
