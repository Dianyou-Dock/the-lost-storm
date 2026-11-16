import { distance } from '../sim/math.ts';
import type { Vec2 } from '../sim/math.ts';
import { mainSlot } from '../sim/ladder.ts';
import { isMoyu } from '../sim/content/moyu.ts';
import { playerMayStrike } from '../sim/world/factions.ts';
import { sameFloor } from '../sim/world/floors.ts';
import { blockedReason } from '../sim/world/skills.ts';
import type { Command, MonsterState, World } from '../sim/world/types.ts';

const AUTO = { search: 8, leash: 10, manualDelay: 0.8 } as const;

export interface AutoCombatState {
  enabled: boolean;
  focus: number | null;
  home: Vec2 | null;
  zone: string;
  delay: number;
}

export interface AutoCombat {
  collect(dt: number, manual: readonly Command[], blocked: boolean): Command[];
}

export function createAutoCombatState(zone: string): AutoCombatState {
  return { enabled: false, focus: null, home: null, zone, delay: 0 };
}

function nearest(world: World, home: Vec2): MonsterState | null {
  let chosen: MonsterState | null = null;
  let best: number = AUTO.search;
  for (const monster of world.monsters) {
    if (!monster.alive || (isMoyu(world.content) && monster.def.boss !== null) || !playerMayStrike(world, monster) || !sameFloor(world, world.player.pos, monster.pos) || distance(home, monster.pos) > AUTO.search) continue;
    const gap: number = distance(world.player.pos, monster.pos);
    if (gap >= best) continue;
    chosen = monster;
    best = gap;
  }
  return chosen;
}

export function planAutoCombat(world: World, state: AutoCombatState, dt: number, manual: readonly Command[], blocked: boolean): Command[] {
  if (state.zone !== world.zone.id) {
    state.zone = world.zone.id;
    state.focus = null;
    state.home = null;
  }
  if (!state.enabled) return [];
  if (manual.length > 0) {
    state.focus = null;
    state.home = null;
    state.delay = AUTO.manualDelay;
    return [];
  }
  state.delay = Math.max(0, state.delay - dt);
  if (blocked || state.delay > 0 || !world.player.alive || world.dialogue !== null || world.death !== null) return [];
  state.home ??= { x: world.player.pos.x, z: world.player.pos.z };
  const intent = world.player.intent;
  if (intent.type === 'attack') {
    if (intent.targetId !== state.focus) return [];
    if (distance(world.player.pos, state.home) <= AUTO.leash) return [];
    state.focus = null;
    state.delay = AUTO.manualDelay;
    return [{ type: 'stop' }];
  }
  if (distance(world.player.pos, state.home) > AUTO.leash) return [];
  if (intent.type !== 'idle' || world.player.action !== null || world.player.queued !== null) return [];
  const slot: number = mainSlot(world.content);
  const skill = world.player.skills[slot];
  if (skill === null || skill === undefined || skill.press !== null || skill.delivery.type === 'dash' || blockedReason(world.player, skill) !== null) return [];
  const target: MonsterState | null = nearest(world, state.home);
  if (target === null) return [];
  state.focus = target.id;
  return [{ type: 'skill', slot, aim: { x: target.pos.x, z: target.pos.z }, targetId: target.id }];
}
