import { isMoyu, moyuNode } from '../content/moyu.ts';
import type { SkillDef } from '../content/types.ts';
import { moyuAffixStrength } from '../items.ts';
import { hasMoyuSpecial } from '../moyu-specials.ts';
import type { MonsterState, PlayerState, World } from './types.ts';

type Element = '金' | '木' | '水' | '火' | '土';
type ElementLook = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

const LOOK: Readonly<Record<Element, ElementLook>> = { 金: 'metal', 木: 'wood', 水: 'water', 火: 'fire', 土: 'earth' };

function legendary(world: World): NonNullable<PlayerState['moyuLegendary']> {
  return world.player.moyuLegendary ??= { goldTarget: null, goldReady: 0, woodReady: 0, waterLast: null, waterReady: 0, fireReady: 0, earthReady: 0 };
}

function legendaryScale(world: World, element: Element): number {
  return elementPower(world, element) > 0 ? 1.25 : 1;
}

function state(player: PlayerState): NonNullable<PlayerState['moyuElements']> {
  return player.moyuElements ??= {
    goldTarget: null, goldHits: 0, goldUntil: 0,
    woodHits: 0, woodReady: 0, waterLast: null,
    fireHeat: 0, fireUntil: 0, earthCharges: 0, earthTime: 0,
  };
}

export function elementPower(world: World, element: Element): number {
  if (!isMoyu(world.content)) return 0;
  const count: number = world.player.allocated.filter((id: string): boolean => id.startsWith(`base-${element}-`)).length;
  if (count < 3) return 0;
  const linked: number = world.player.allocated.filter((id: string): boolean => {
    const node = moyuNode(id);
    return node !== null && ['word', 'synergy', 'variant', 'confluence'].includes(node.type) && [node.element, node.support, node.third].includes(element);
  }).length;
  const gear: number = Object.values(world.player.equipped).reduce((sum: number, item): number =>
    sum + (item?.affixes.reduce((part: number, affix): number => part + (affix.affix === `moyu_${element}` ? moyuAffixStrength(affix.affix, affix.value) : 0), 0) ?? 0), 0);
  return Math.min(1.6, 1 + (count >= 5 ? 0.15 : 0) + (count >= 8 ? 0.15 : 0) + Math.min(0.2, linked * 0.05) + gear);
}

function announce(world: World, element: Element, text: string, pos: { readonly x: number; readonly z: number }): void {
  world.events.push({ type: 'moyu_element', element: LOOK[element], text, pos: { x: pos.x, z: pos.z } });
}

export function goldStrike(world: World, target: MonsterState): number {
  const power: number = elementPower(world, '金');
  if (power === 0) return 0;
  const held = state(world.player);
  held.goldHits = held.goldTarget === target.id && world.time <= held.goldUntil ? held.goldHits + 1 : 1;
  held.goldTarget = target.id;
  held.goldUntil = world.time + 3;
  if (held.goldHits < 3) return 0;
  held.goldHits = 0;
  announce(world, '金', '破绽', target.pos);
  return Math.min(0.6, 0.35 * power);
}

export function legendaryGoldGuard(world: World, target: MonsterState): void {
  if (!hasMoyuSpecial(world, '金')) return;
  const held = legendary(world);
  if (held.goldTarget === target.id && world.time < held.goldReady) return;
  held.goldTarget = target.id;
  held.goldReady = world.time + 3;
  world.player.mana = Math.min(world.player.stats.maxMana, world.player.mana + 2 * legendaryScale(world, '金'));
  announce(world, '金', '断势回能', target.pos);
}

export function legendaryWoodHit(world: World): void {
  if (!hasMoyuSpecial(world, '木') || world.player.life >= world.player.maxLife * 0.5) return;
  const held = legendary(world);
  if (world.time < held.woodReady) return;
  held.woodReady = world.time + 5;
  world.player.life = Math.min(world.player.maxLife, world.player.life + world.player.maxLife * 0.02 * legendaryScale(world, '木'));
  announce(world, '木', '回春', world.player.pos);
}

export function legendaryFireKill(world: World): void {
  if (!hasMoyuSpecial(world, '火')) return;
  const held = legendary(world);
  if (world.time < held.fireReady) return;
  held.fireReady = world.time + 3;
  world.player.mana = Math.min(world.player.stats.maxMana, world.player.mana + 4 * legendaryScale(world, '火'));
  announce(world, '火', '余烬回能', world.player.pos);
}

export function legendaryEarthGuard(world: World): number {
  if (!hasMoyuSpecial(world, '土') || world.player.moving) return 1;
  const held = legendary(world);
  if (world.time < held.earthReady) return 1;
  held.earthReady = world.time + 5;
  announce(world, '土', '磐石抵挡', world.player.pos);
  return 1 - 0.12 * legendaryScale(world, '土');
}

export function woodStrike(world: World): void {
  const power: number = elementPower(world, '木');
  if (power === 0) return;
  const held = state(world.player);
  held.woodHits += 1;
  if (held.woodHits < 3 || world.time < held.woodReady) return;
  held.woodHits = 0;
  held.woodReady = world.time + 3;
  const player = world.player;
  const healed: number = Math.min(player.maxLife - player.life, Math.max(1, player.maxLife * 0.025 * power));
  if (healed <= 0) return;
  player.life += healed;
  announce(world, '木', `生息 +${Math.round(healed)}`, player.pos);
}

export function startElementSkill(world: World, player: PlayerState, skill: SkillDef): number {
  if (!isMoyu(world.content) || skill.delivery.type === 'dash') return 1;
  if (hasMoyuSpecial(world, '水')) {
    const held = legendary(world);
    if (held.waterLast !== null && held.waterLast !== skill.id && world.time >= held.waterReady) {
      player.mana = Math.min(player.stats.maxMana, player.mana + 2 * legendaryScale(world, '水'));
      held.waterReady = world.time + 3;
      announce(world, '水', '清流回能', player.pos);
    }
    held.waterLast = skill.id;
  }
  const held = state(player);
  const water: number = elementPower(world, '水');
  if (water > 0 && held.waterLast !== null && held.waterLast !== skill.id) {
    player.mana = Math.min(player.stats.maxMana, player.mana + 3 * water);
    player.cooldowns[skill.id] = Math.max(0, skill.cooldown * (1 - Math.min(0.25, 0.16 * water)));
    announce(world, '水', '流转', player.pos);
  }
  held.waterLast = skill.id;

  const fire: number = elementPower(world, '火');
  let speed: number = 1;
  if (fire > 0) {
    held.fireHeat = world.time <= held.fireUntil ? held.fireHeat + 1 : 1;
    held.fireUntil = world.time + 2.5;
    if (held.fireHeat >= 3) {
      held.fireHeat = 0;
      speed = 1 - Math.min(0.3, 0.2 * fire);
      announce(world, '火', '燃势', player.pos);
    }
  }

  if (elementPower(world, '土') > 0) {
    held.earthCharges = Math.min(2, held.earthCharges + 1);
    held.earthTime = 4;
    if (held.earthCharges === 1) announce(world, '土', '守势', player.pos);
  }
  return speed;
}

export function earthGuard(world: World): number {
  const power: number = elementPower(world, '土');
  const held = state(world.player);
  if (held.earthCharges === 0 || held.earthTime <= 0) return 1;
  held.earthCharges -= 1;
  announce(world, '土', '守势抵挡', world.player.pos);
  return 1 - Math.min(0.3, 0.18 * Math.max(1, power));
}

export function stepMoyuElements(world: World, dt: number): void {
  const held = world.player.moyuElements;
  if (held === undefined) return;
  held.earthTime = Math.max(0, held.earthTime - dt * (world.player.moving ? 3 : 1));
  if (held.earthTime === 0) held.earthCharges = 0;
}
