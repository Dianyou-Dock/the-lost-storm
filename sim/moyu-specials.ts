import type { Rng } from './rng.ts';
import type { ItemInstance } from './world/types.ts';
import type { World } from './world/types.ts';
import { isMoyu } from './content/moyu.ts';

export const MOYU_SPECIALS = {
  金: { name: '断势', text: '攻击被格挡时返还 2 点能量；同一目标每 3 秒最多触发一次。' },
  木: { name: '回春', text: '生命低于一半时命中敌人，恢复 2% 最大生命；每 5 秒最多触发一次。' },
  水: { name: '清流', text: '交替施放不同技能时，额外返还 2 点能量；每 3 秒最多触发一次。' },
  火: { name: '余烬', text: '击杀敌人时返还 4 点能量；每 3 秒最多触发一次。' },
  土: { name: '磐石', text: '原地承受攻击时额外减伤 12%；每 5 秒最多触发一次。' },
} as const;

export type MoyuSpecial = keyof typeof MOYU_SPECIALS;
export const MOYU_ELEMENTS: readonly MoyuSpecial[] = ['金', '木', '水', '火', '土'];

export function rollMoyuSpecial(rng: Rng): MoyuSpecial {
  return MOYU_ELEMENTS[rng.int(0, MOYU_ELEMENTS.length - 1)] ?? '金';
}

export function isMoyuSpecial(value: unknown): value is MoyuSpecial {
  return typeof value === 'string' && Object.hasOwn(MOYU_SPECIALS, value);
}

// Older legendary saves have no special field. The fallback stays stable across saves and trades.
export function moyuSpecialOf(item: Pick<ItemInstance, 'base' | 'rarity' | 'level' | 'affixes' | 'special'>): MoyuSpecial | null {
  if (item.rarity !== 'stormtouched') return null;
  if (isMoyuSpecial(item.special)) return item.special;
  const source = `${item.base}:${item.level}:${item.affixes.map((affix): string => `${affix.affix}:${affix.value}`).join('|')}`;
  let hash = 0;
  for (const char of source) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  return MOYU_ELEMENTS[hash % MOYU_ELEMENTS.length] ?? '金';
}

export function hasMoyuSpecial(world: World, special: MoyuSpecial): boolean {
  return isMoyu(world.content) && Object.values(world.player.equipped).some((item): boolean => item !== null && moyuSpecialOf(item) === special);
}
