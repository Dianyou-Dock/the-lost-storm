import type { Fields } from './read.ts';
import { choice, ContentError, each, fields, nonNegative, positive, share, text } from './read.ts';
import type { SkillVfx, VfxGather, VfxImpact, VfxLightning } from './vfx-types.ts';
import { VFX_CUES, VFX_MAX_FORKS, VFX_STYLES } from './vfx-types.ts';

function vfxLightning(value: unknown, where: string): VfxLightning | null {
  if (value === undefined) return null;
  const source: Fields = fields(value, where);
  const forks: number = nonNegative(source, 'forks', where);
  if (!Number.isInteger(forks) || forks > VFX_MAX_FORKS) throw new ContentError(`${where}.forks`, `expected a whole number from 0 to ${VFX_MAX_FORKS}`);
  return {
    forks,
    glow: share(source, 'glow', where),
    afterglow: positive(source, 'afterglow', where),
    jitter: nonNegative(source, 'jitter', where),
    width: source['width'] === undefined ? 1 : positive(source, 'width', where),
    core: source['core'] === undefined ? 1 : nonNegative(source, 'core', where),
  };
}

function vfxImpact(value: unknown, where: string): VfxImpact | null {
  if (value === undefined) return null;
  const source: Fields = fields(value, where);
  const sparks: number = nonNegative(source, 'sparks', where);
  if (!Number.isInteger(sparks)) throw new ContentError(`${where}.sparks`, 'expected a whole number');
  return { sparks, flash: nonNegative(source, 'flash', where) };
}

export const GATHER_MIN_SAMPLES: number = 2;

function gatherCurve(value: unknown, where: string): readonly number[] {
  const samples: number[] = each(value, where, (entry: unknown, entryWhere: string): number => {
    if (typeof entry !== 'number' || entry < 0 || entry > 1) throw new ContentError(entryWhere, 'expected a number from 0 to 1');
    return entry;
  });
  if (samples.length < GATHER_MIN_SAMPLES) throw new ContentError(where, `expected at least ${GATHER_MIN_SAMPLES} samples`);
  return samples;
}

function vfxGather(value: unknown, where: string): VfxGather | null {
  if (value === undefined) return null;
  const source: Fields = fields(value, where);
  return {
    radius: positive(source, 'radius', where),
    lift: nonNegative(source, 'lift', where),
    size: gatherCurve(source['size'], `${where}.size`),
    glow: gatherCurve(source['glow'], `${where}.glow`),
    dust: nonNegative(source, 'dust', where),
    light: nonNegative(source, 'light', where),
  };
}

export function skillVfx(value: unknown, where: string): SkillVfx {
  const source: Fields = fields(value, where);
  return {
    style: choice(source, 'style', VFX_STYLES, where),
    color: text(source, 'color', where),
    cue: source['cue'] === undefined ? 'none' : choice(source, 'cue', VFX_CUES, where),
    light: source['light'] === undefined ? 1 : nonNegative(source, 'light', where),
    lightning: vfxLightning(source['lightning'], `${where}.lightning`),
    impact: vfxImpact(source['impact'], `${where}.impact`),
    trail: source['trail'] === undefined ? 0 : nonNegative(source, 'trail', where),
    linger: source['linger'] === undefined ? 0 : nonNegative(source, 'linger', where),
    gather: vfxGather(source['gather'], `${where}.gather`),
  };
}
