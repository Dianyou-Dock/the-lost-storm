import type { Content, ItemBaseDef, SkillDef, SkillTreeNodeDef, WeaponGroup, WeaponKind } from './content/types.ts';
import type { Equipment } from './world/types.ts';

export function groupOfKind(content: Content, kind: WeaponKind): WeaponGroup | null {
  return content.chart.weaponGroups.find((group: WeaponGroup): boolean => group.kinds.includes(kind)) ?? null;
}

export function weaponGroup(content: Content, id: string): WeaponGroup | null {
  return content.chart.weaponGroups.find((group: WeaponGroup): boolean => group.id === id) ?? null;
}

export function heldGroup(content: Content, equipped: Equipment): string | null {
  const held = equipped.weapon;
  if (held === null) return null;
  const base: ItemBaseDef | undefined = content.itemBases.get(held.base);
  if (base === undefined || base.weaponKind === null) return null;
  return groupOfKind(content, base.weaponKind)?.id ?? null;
}

export function skillAllowed(skill: SkillDef, held: string | null): boolean {
  return skill.weapons.length === 0 || (held !== null && skill.weapons.includes(held));
}

export function placeLive(node: SkillTreeNodeDef, held: string | null): boolean {
  return node.weapon === null || node.weapon === held;
}
