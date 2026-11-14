import type { MonsterScaling, ScalingRamp } from '../content/types.ts';

export interface MonsterScale {
  readonly life: number;
  readonly damage: number;
}

export function monsterScale(scaling: MonsterScaling, level: number): MonsterScale {
  const steps: number = level - 1;
  const gentle: MonsterScale = { life: 1 + scaling.lifePerLevel * steps, damage: 1 + scaling.damagePerLevel * steps };
  const ramp: ScalingRamp | null = scaling.ramp;
  if (ramp === null || level <= ramp.from) return gentle;
  const steep: MonsterScale = { life: 1 + ramp.lifePerLevel * steps, damage: 1 + ramp.damagePerLevel * steps };
  if (level >= ramp.to) return steep;
  const weight: number = (level - ramp.from) / (ramp.to - ramp.from);
  return { life: gentle.life + (steep.life - gentle.life) * weight, damage: gentle.damage + (steep.damage - gentle.damage) * weight };
}
