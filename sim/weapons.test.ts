import assert from 'node:assert/strict';
import { test } from 'node:test';
import { must } from '../test/support.ts';
import { loadContent } from './content/content.ts';
import type { Content, SkillDef, SkillTreeNodeDef } from './content/types.ts';
import { emptyEquipment } from './items.ts';
import { groupOfKind, heldGroup, placeLive, skillAllowed, weaponGroup } from './weapons.ts';
import type { Equipment, ItemInstance } from './world/types.ts';

const content: Content = loadContent();

function holding(base: string): Equipment {
  const item: ItemInstance = { uid: 1, base, rarity: 'common', level: 1, affixes: [], ledger: null };
  return { ...emptyEquipment(), weapon: item };
}

void test('every weapon kind belongs to one group: axes are blades, maces and greatswords are heavy', (): void => {
  assert.equal(groupOfKind(content, 'axe')?.id, 'blade');
  assert.equal(groupOfKind(content, 'blunt')?.id, 'heavy');
  assert.equal(groupOfKind(content, 'greatsword')?.id, 'heavy');
  assert.equal(groupOfKind(content, 'staff')?.id, 'staff');
  assert.equal(weaponGroup(content, 'crossbow')?.name, 'Crossbow');
  assert.equal(weaponGroup(content, 'wand'), null);
});

void test('the held group comes from the weapon in hand, and empty hands hold none', (): void => {
  assert.equal(heldGroup(content, emptyEquipment()), null);
  assert.equal(heldGroup(content, holding('woodsman_hatchet')), 'blade');
  assert.equal(heldGroup(content, holding('iron_maul')), 'heavy');
  assert.equal(heldGroup(content, holding('worn_crossbow')), 'crossbow');
  assert.equal(heldGroup(content, holding('no_such_weapon')), null);
});

void test('a skill with no weapons list is cast with anything, one with a list only with a weapon it names', (): void => {
  const cleave: SkillDef = must(content.skills.get('cleave'), 'cleave');
  const staffOnly: SkillDef = { ...cleave, weapons: ['staff'] };
  assert.equal(skillAllowed(cleave, null), true);
  assert.equal(skillAllowed(cleave, 'crossbow'), true);
  assert.equal(skillAllowed(staffOnly, 'staff'), true);
  assert.equal(skillAllowed(staffOnly, 'blade'), false);
  assert.equal(skillAllowed(staffOnly, null), false);
});

void test('a place with no weapon is live with anything, one with a weapon only with that weapon', (): void => {
  const node: SkillTreeNodeDef = must(content.skillTree[0], 'node');
  assert.equal(placeLive({ ...node, weapon: null }, null), true);
  assert.equal(placeLive({ ...node, weapon: 'heavy' }, 'heavy'), true);
  assert.equal(placeLive({ ...node, weapon: 'heavy' }, 'blade'), false);
  assert.equal(placeLive({ ...node, weapon: 'heavy' }, null), false);
});
