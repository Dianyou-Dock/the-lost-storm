import { distance } from '../sim/math.ts';
import type { Vec2 } from '../sim/math.ts';
import { mainSlot } from '../sim/ladder.ts';
import { isMoyu } from '../sim/content/moyu.ts';
import { playerMayStrike } from '../sim/world/factions.ts';
import { blockedReason } from '../sim/world/skills.ts';
import { autoPickupAllows } from './loot-filter.ts';
import type { Command, MonsterState, World } from '../sim/world/types.ts';

const AUTO = { manualDelay: 0.8 } as const;

export interface AutoCombatState {
  enabled: boolean;
  focus: number | null;
  home: Vec2 | null;
  zone: string;
  delay: number;
  lastSlot: number | null;
  random: number;
}

export interface AutoCombat {
  collect(dt: number, manual: readonly Command[], blocked: boolean): Command[];
}

export function createAutoCombatState(zone: string): AutoCombatState {
  return { enabled: false, focus: null, home: null, zone, delay: 0, lastSlot: null, random: Math.floor(Math.random() * 0x1_0000_0000) };
}

function nextRandom(state: AutoCombatState): number {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  return state.random / 0x1_0000_0000;
}

function readySlot(world: World, state: AutoCombatState): number | null {
  const main = mainSlot(world.content);
  if (!isMoyu(world.content)) {
    const skill = world.player.skills[main];
    return skill !== null && skill !== undefined && skill.press === null && skill.delivery.type !== 'dash' && blockedReason(world.player, skill) === null ? main : null;
  }
  const seen = new Set<string>();
  const choices: number[] = [];
  for (const [slot, skill] of world.player.skills.entries()) {
    if (skill === null || skill.press !== null || skill.delivery.type === 'dash' || blockedReason(world.player, skill) !== null || seen.has(skill.id)) continue;
    seen.add(skill.id);
    choices.push(slot);
  }
  if (choices.length === 0) return null;
  const weights = choices.map((slot): number => slot === state.lastSlot && choices.length > 1 ? 1 : 3);
  let ticket = Math.floor(nextRandom(state) * weights.reduce((sum, weight): number => sum + weight, 0));
  for (const [index, slot] of choices.entries()) {
    ticket -= weights[index] ?? 0;
    if (ticket < 0) return slot;
  }
  return choices[0] ?? null;
}

function nearest(world: World): MonsterState | null {
  let chosen: MonsterState | null = null;
  let best: number = Number.POSITIVE_INFINITY;
  for (const monster of world.monsters) {
    if (!monster.alive || (isMoyu(world.content) && monster.def.boss !== null) || !playerMayStrike(world, monster)) continue;
    const gap: number = distance(world.player.pos, monster.pos);
    if (gap >= best) continue;
    chosen = monster;
    best = gap;
  }
  return chosen;
}

function upkeep(world: World): Command | null {
  for (const [slot, flask] of world.player.flasks.entries()) {
    const current = flask.def.resource === 'life' ? world.player.life : world.player.mana;
    const maximum = flask.def.resource === 'life' ? world.player.maxLife : world.player.stats.maxMana;
    if (maximum > 0 && current / maximum < (flask.def.resource === 'life' ? 0.6 : 0.3) && flask.charges >= flask.def.chargesPerUse && flask.cooldown <= 0) return { type: 'flask', slot };
  }
  return null;
}

function nearestGround(world: World): Extract<Command, { readonly type: 'pickup' }> | null {
  let chosen: typeof world.ground[number] | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const ground of world.ground) {
    if (isMoyu(world.content) && !autoPickupAllows(world.content, ground)) continue;
    const gap = distance(world.player.pos, ground.pos);
    if (gap >= best) continue;
    chosen = ground;
    best = gap;
  }
  return chosen === null ? null : { type: 'pickup', groundId: chosen.id };
}

export function planAutoCombat(world: World, state: AutoCombatState, dt: number, manual: readonly Command[], blocked: boolean): Command[] {
  if (state.zone !== world.zone.id) {
    state.zone = world.zone.id;
    state.focus = null;
    state.home = null;
    state.lastSlot = null;
  }
  if (!state.enabled) return [];
  if (manual.length > 0) {
    state.focus = null;
    state.home = null;
    state.lastSlot = null;
    state.delay = AUTO.manualDelay;
    return [];
  }
  state.delay = Math.max(0, state.delay - dt);
  if (blocked || state.delay > 0 || !world.player.alive || world.dialogue !== null || world.death !== null) return [];
  if (isMoyu(world.content)) {
    const flask = upkeep(world);
    if (flask !== null) return [flask];
  }
  const intent = world.player.intent;
  if (intent.type === 'attack') {
    if (intent.targetId !== state.focus) return [];
    return [];
  }
  if (intent.type !== 'idle' || world.player.action !== null || world.player.queued !== null) return [];
  const target: MonsterState | null = nearest(world);
  if (isMoyu(world.content) && (target === null || distance(world.player.pos, target.pos) > 8)) {
    const pickup = nearestGround(world);
    if (pickup !== null && world.ground.some((ground): boolean => ground.id === pickup.groundId && distance(world.player.pos, ground.pos) < 5)) return [pickup];
  }
  if (target === null) {
    const pickup = isMoyu(world.content) ? nearestGround(world) : null;
    return pickup === null ? [] : [pickup];
  }
  const slot = readySlot(world, state);
  if (slot === null) return [];
  state.focus = target.id;
  state.lastSlot = slot;
  return [{ type: 'skill', slot, aim: { x: target.pos.x, z: target.pos.z }, targetId: target.id }];
}
