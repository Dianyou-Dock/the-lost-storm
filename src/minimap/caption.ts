import type { World } from '../../sim/world/types.ts';
import type { LevelSpan } from '../../sim/world/spawn.ts';
import { levelSpan } from '../../sim/world/spawn.ts';

export function zoneLevelText(world: World): string | null {
  if (world.zone.kind !== 'wild') return null;
  const span: LevelSpan = levelSpan(world);
  return span.least === span.most ? `Level ${span.least}` : `Level ${span.least}–${span.most}`;
}
