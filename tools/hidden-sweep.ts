import type { Content, ZoneDef } from '../sim/content/types.ts';
import { buildNavGrid, isWalkable } from '../sim/nav/grid.ts';
import type { NavGrid } from '../sim/nav/grid.ts';
import { CUTAWAY } from '../src/render/prop-cutaway.ts';
import type { ClickLanding, ClickRule, FloorSpot, TerrainSight } from '../src/render/terrain-sight.ts';
import { clickLanding, clickMiss, createTerrainSight, heroHidden } from '../src/render/terrain-sight.ts';

export const HIDDEN_SWEEP = {
  clickNear: 1.5,
  spacing: 1,
  listed: 12,
  heroAway: [1.5, 3],
  heroTurns: 8,
  radii: [CUTAWAY.radius, CUTAWAY.widest],
} as const;

export interface ClickCount {
  readonly before: number;
  readonly after: readonly string[];
}

export interface ZoneSweep {
  readonly zone: string;
  readonly walkable: number;
  readonly hidden: number;
  readonly cutHidden: readonly string[];
  readonly missedBefore: number;
  readonly missed: readonly string[];
  readonly inWindow: number;
  readonly window: ClickCount;
  readonly bare: ClickCount;
}

interface Tally {
  before: number;
  readonly after: string[];
}

function heroesNear(grid: NavGrid, x: number, z: number): FloorSpot[] {
  const heroes: FloorSpot[] = [];
  for (const away of HIDDEN_SWEEP.heroAway) {
    for (let turn: number = 0; turn < HIDDEN_SWEEP.heroTurns; turn += 1) {
      const angle: number = (turn / HIDDEN_SWEEP.heroTurns) * Math.PI * 2;
      const hero: FloorSpot = { x: x + Math.cos(angle) * away, z: z + Math.sin(angle) * away };
      if (isWalkable(grid, hero.x, hero.z)) heroes.push(hero);
    }
  }
  return heroes;
}

interface Reach {
  readonly reached: boolean;
  readonly missed: boolean;
}

function missesFrom(sight: TerrainSight, zone: ZoneDef, heroes: readonly FloorSpot[], target: FloorSpot, radius: number | null, rule: ClickRule): Reach {
  let reached: boolean = false;
  for (const hero of heroes) {
    const landing: ClickLanding = clickLanding(sight, zone, hero, target, radius, rule);
    if (radius !== null && !landing.windowed) continue;
    reached = true;
    if (landing.miss > HIDDEN_SWEEP.clickNear) return { reached, missed: true };
  }
  return { reached, missed: false };
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
  let inWindow: number = 0;
  const window: Tally = { before: 0, after: [] };
  const bare: Tally = { before: 0, after: [] };
  for (let z: number = HIDDEN_SWEEP.spacing / 2; z < depth; z += HIDDEN_SWEEP.spacing) {
    for (let x: number = HIDDEN_SWEEP.spacing / 2; x < width; x += HIDDEN_SWEEP.spacing) {
      if (!isWalkable(grid, x, z)) continue;
      walkable += 1;
      const spot: string = `${x},${z}`;
      if (clickMiss(sight, zone, x, z, false, 'surface') > HIDDEN_SWEEP.clickNear) missedBefore += 1;
      if (clickMiss(sight, zone, x, z, true) > HIDDEN_SWEEP.clickNear) missed.push(spot);
      const heroes: FloorSpot[] = heroesNear(grid, x, z);
      const target: FloorSpot = { x, z };
      if (missesFrom(sight, zone, heroes, target, null, 'surface').missed) bare.before += 1;
      if (missesFrom(sight, zone, heroes, target, null, 'floor').missed) bare.after.push(spot);
      let reached: boolean = false;
      let before: boolean = false;
      let after: boolean = false;
      for (const radius of HIDDEN_SWEEP.radii) {
        const old: Reach = missesFrom(sight, zone, heroes, target, radius, 'surface');
        const now: Reach = missesFrom(sight, zone, heroes, target, radius, 'floor');
        reached ||= old.reached;
        before ||= old.missed;
        after ||= now.missed;
      }
      if (reached) inWindow += 1;
      if (before) window.before += 1;
      if (after) window.after.push(spot);
      if (!heroHidden(sight, zone, x, z, false)) continue;
      hidden += 1;
      if (heroHidden(sight, zone, x, z, true)) cutHidden.push(spot);
    }
  }
  return { zone: zone.id, walkable, hidden, cutHidden, missedBefore, missed, inWindow, window, bare };
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
  return swept.some((zone: ZoneSweep): boolean => zone.cutHidden.length > 0 || zone.missed.length > 0 || zone.window.after.length > 0 || zone.bare.after.length > 0);
}

export function sweepLines(swept: readonly ZoneSweep[]): string[] {
  const lines: string[] = [
    'zone | walkable m² | rock hides hero m² (no window) | hidden with window m² | click on hero lands off him m² (old rule, no window) | now, with window | floor inside a nearby hero’s open window m² | click there lands off it m² (old rule) | now | click with no window lands off the floor m² (old rule) | now',
    '--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---',
  ];
  for (const zone of swept) {
    lines.push(`${zone.zone} | ${zone.walkable} | ${zone.hidden} | ${zone.cutHidden.length} | ${zone.missedBefore} | ${zone.missed.length} | ${zone.inWindow} | ${zone.window.before} | ${zone.window.after.length} | ${zone.bare.before} | ${zone.bare.after.length}`);
    if (zone.cutHidden.length > 0) lines.push(`  hidden with window at ${zone.cutHidden.slice(0, HIDDEN_SWEEP.listed).join(' ')}`);
    if (zone.missed.length > 0) lines.push(`  click lands off hero at ${zone.missed.slice(0, HIDDEN_SWEEP.listed).join(' ')}`);
    if (zone.window.after.length > 0) lines.push(`  click inside the window lands off the floor at ${zone.window.after.slice(0, HIDDEN_SWEEP.listed).join(' ')}`);
    if (zone.bare.after.length > 0) lines.push(`  click with no window lands off the floor at ${zone.bare.after.slice(0, HIDDEN_SWEEP.listed).join(' ')}`);
  }
  lines.push(sweepFailed(swept) ? 'FAIL: the hero can be hidden, or a click on the floor lands elsewhere, at the floor listed above' : 'PASS: the window shows the hero, and a click on every walkable square metre lands on it, with or without the window');
  return lines;
}
