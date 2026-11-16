import assert from 'node:assert/strict';
import { test } from 'node:test';
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
