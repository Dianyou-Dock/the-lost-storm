import { attacksHeld } from './glitch-hold.ts';
import { kill, teamOf } from './combat.ts';
import { holdLine, strikesOf } from './count.ts';
import type { Actor, BurnState, World } from './types.ts';
import { isMoyu } from '../content/moyu.ts';

export const BURN = {
  fallDirection: { x: 0, z: 1 },
} as const;

function scorch(world: World, target: Actor, burn: BurnState): boolean {
  if (target.kind === 'player' && (target.invulnerable > 0 || attacksHeld(world))) return true;
  const source = world.monsters.find((monster): boolean => monster.id === burn.offence.sourceId);
  const amount: number = target.kind === 'monster' ? holdLine(world, target, strikesOf(target) === null ? burn.perTick : 0) : isMoyu(world.content) && source?.def.boss === null ? Math.min(burn.perTick, Math.max(0, target.life - 1)) : burn.perTick;
  target.life -= amount;
  const killed: boolean = target.life <= 0;
  world.events.push({
    type: 'damage',
    targetId: target.id,
    sourceId: burn.offence.sourceId,
    targetTeam: teamOf(target),
    amount,
    crit: false,
    killed,
    pos: { x: target.pos.x, z: target.pos.z },
    direction: { x: BURN.fallDirection.x, z: BURN.fallDirection.z },
    skill: burn.skill,
    burn: true,
  });
  if (killed) kill(world, target, BURN.fallDirection);
  return !killed;
}

function stepBurn(world: World, target: Actor, dt: number): void {
  const burn: BurnState | null = target.burn;
  if (burn === null) return;
  if (!target.alive) {
    target.burn = null;
    return;
  }
  const tick: number = burn.skill.burn?.tick ?? 0;
  burn.tickLeft -= dt;
  let burning: boolean = true;
  while (burn.tickLeft <= 0 && burn.ticksLeft > 0 && burning) {
    burning = scorch(world, target, burn);
    burn.ticksLeft -= 1;
    burn.tickLeft += tick;
  }
  if (burn.ticksLeft <= 0 || !burning) target.burn = null;
}

export function stepBurns(world: World, dt: number): void {
  stepBurn(world, world.player, dt);
  for (const monster of world.monsters) stepBurn(world, monster, dt);
}
