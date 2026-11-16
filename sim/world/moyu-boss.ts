import { isMoyu, moyuBossFlag } from '../content/moyu.ts';
import { refreshNpcs } from './dialogue.ts';
import { spawnPack } from './packs.ts';
import type { World, WorldEvent } from './types.ts';

export function stepMoyuBoss(world: World): void {
  if (!isMoyu(world.content) || world.flags[moyuBossFlag(world.zone.id)] !== undefined) return;
  const talk = `moyu_challenger_${world.zone.id}_challenge`;
  const accepted = world.events.some((event: WorldEvent): boolean => event.type === 'dialogue_closed' && event.finished && event.talk === talk);
  if (!accepted) return;
  const pack = world.zone.packs.find((entry): boolean => entry.members.some((member): boolean => member.monster === `moyu_boss_${world.zone.id}`));
  if (pack === undefined || world.spawnedPacks.includes(pack)) return;
  world.flags[moyuBossFlag(world.zone.id)] = 'active';
  refreshNpcs(world);
  spawnPack(world, pack, 0, true);
}
