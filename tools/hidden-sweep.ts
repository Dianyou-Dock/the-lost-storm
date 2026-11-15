import type { Content, ZoneDef } from '../sim/content/types.ts';
import { buildNavGrid, isWalkable } from '../sim/nav/grid.ts';
import type { NavGrid } from '../sim/nav/grid.ts';
import type { TerrainSight } from '../src/render/terrain-sight.ts';
import { clickMiss, createTerrainSight, heroHidden } from '../src/render/terrain-sight.ts';

export const HIDDEN_SWEEP = {
  clickNear: 1.5,
  spacing: 1,
  listed: 12,
} as const;

export interface ZoneSweep {
  readonly zone: string;
  readonly walkable: number;
  readonly hidden: number;
  readonly cutHidden: readonly string[];
  readonly missedBefore: number;
  readonly missed: readonly string[];
}

export function sweepZone(content: Content, zone: ZoneDef, sight: TerrainSight): ZoneSweep {
  const grid: NavGrid = buildNavGrid(zone, content.props, content.surfaces, content.player.radius);
  const width: number = (zone.tiles[0]?.length ?? 0) * zone.cellSize;
  const depth: number = zone.tiles.length * zone.cellSize;
  let walkable: number = 0;
  let hidden: number = 0;
  const cutHidden: string[] = [];
  let missedBefore: number = 0;
  const missed: string[] = [];
  for (let z: number = HIDDEN_SWEEP.spacing / 2; z < depth; z += HIDDEN_SWEEP.spacing) {
    for (let x: number = HIDDEN_SWEEP.spacing / 2; x < width; x += HIDDEN_SWEEP.spacing) {
      if (!isWalkable(grid, x, z)) continue;
      walkable += 1;
      if (clickMiss(sight, zone, x, z, false) > HIDDEN_SWEEP.clickNear) missedBefore += 1;
      if (clickMiss(sight, zone, x, z, true) > HIDDEN_SWEEP.clickNear) missed.push(`${x},${z}`);
      if (!heroHidden(sight, zone, x, z, false)) continue;
      hidden += 1;
      if (heroHidden(sight, zone, x, z, true)) cutHidden.push(`${x},${z}`);
    }
  }
  return { zone: zone.id, walkable, hidden, cutHidden, missedBefore, missed };
}

export function sweepZones(content: Content): ZoneSweep[] {
  const swept: ZoneSweep[] = [];
  for (const zone of content.zones.values()) {
    const sight: TerrainSight | null = createTerrainSight(zone);
    if (sight !== null) swept.push(sweepZone(content, zone, sight));
  }
  return swept;
}

export function sweepFailed(swept: readonly ZoneSweep[]): boolean {
  return swept.some((zone: ZoneSweep): boolean => zone.cutHidden.length > 0 || zone.missed.length > 0);
}

export function sweepLines(swept: readonly ZoneSweep[]): string[] {
  const lines: string[] = ['zone | walkable m² | rock hides hero m² (no window) | hidden with window m² | click lands off hero m² (no window) | with window m²', '--- | --- | --- | --- | --- | ---'];
  for (const zone of swept) {
    lines.push(`${zone.zone} | ${zone.walkable} | ${zone.hidden} | ${zone.cutHidden.length} | ${zone.missedBefore} | ${zone.missed.length}`);
    if (zone.cutHidden.length > 0) lines.push(`  hidden with window at ${zone.cutHidden.slice(0, HIDDEN_SWEEP.listed).join(' ')}`);
    if (zone.missed.length > 0) lines.push(`  click lands off hero at ${zone.missed.slice(0, HIDDEN_SWEEP.listed).join(' ')}`);
  }
  lines.push(sweepFailed(swept) ? 'FAIL: the hero can be hidden, or a click on him lands elsewhere, on the floor listed above' : 'PASS: the window shows the hero and takes clicks on every walkable square metre');
  return lines;
}
