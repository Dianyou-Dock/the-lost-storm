import type { Content } from '../sim/content/types.ts';
import type { GroundItem } from '../sim/world/types.ts';

let minimumRank: number = 0;

export function pickupMinimum(): number {
  return minimumRank;
}

export function setPickupMinimum(rank: number): void {
  minimumRank = Math.max(0, Math.min(4, Math.floor(rank)));
}

export function autoPickupAllows(content: Content, ground: GroundItem, minimum: number = minimumRank): boolean {
  if (ground.content.kind === 'gold') return true;
  const rarityId: string = ground.content.item.rarity;
  const rank: number = content.rarities.findIndex((rarity): boolean => rarity.id === rarityId);
  return rank >= minimum;
}
