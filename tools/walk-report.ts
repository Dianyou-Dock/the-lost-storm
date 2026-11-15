import { fields, flag, items, numeric, text } from '../sim/content/read.ts';
import type { Fields } from '../sim/content/read.ts';

export const WALK_DEFAULTS = {
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  port: 5461,
  width: 1280,
  height: 800,
  hero: 'woman',
} as const;

export interface WalkArgs {
  readonly url: string | null;
  readonly chrome: string;
  readonly port: number;
  readonly hero: string;
}

export interface WalkLook {
  readonly zone: string;
  readonly afterMs: number;
  readonly live: number;
  readonly missing: readonly string[];
}

export interface WalkSummary {
  readonly ok: boolean;
  readonly looks: readonly WalkLook[];
  readonly problems: readonly string[];
}

export function walkArgs(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): WalkArgs {
  const valueOf = (name: string): string | null => {
    const at: number = argv.indexOf(name);
    const value: string | undefined = at < 0 ? undefined : argv[at + 1];
    return value === undefined || value.startsWith('--') ? null : value;
  };
  const port: number = Number(valueOf('--port') ?? WALK_DEFAULTS.port);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`--port must be a port number, not ${valueOf('--port') ?? ''}`);
  const url: string | null = valueOf('--url');
  const hero: string = valueOf('--hero') ?? WALK_DEFAULTS.hero;
  if (!/^[a-z]+$/.test(hero)) throw new Error(`--hero must be a hero id, not ${hero}`);
  return { url: url === null ? null : url.replace(/\/+$/, ''), chrome: valueOf('--chrome') ?? env['CHROME_PATH'] ?? WALK_DEFAULTS.chrome, port, hero };
}

function readLook(value: unknown, where: string): WalkLook {
  const source: Fields = fields(value, where);
  return { zone: text(source, 'zone', where), afterMs: numeric(source, 'afterMs', where), live: numeric(source, 'live', where), missing: items(source['missing'], `${where}.missing`).map((entry: unknown, index: number): string => text({ entry }, 'entry', `${where}.missing[${index}]`)) };
}

export function readWalk(value: unknown): WalkSummary {
  const source: Fields = fields(value, 'walk');
  return {
    ok: flag(source, 'ok', 'walk'),
    looks: items(source['looks'], 'walk.looks').map((entry: unknown, index: number): WalkLook => readLook(entry, `walk.looks[${index}]`)),
    problems: items(source['problems'], 'walk.problems').map((entry: unknown, index: number): string => text({ entry }, 'entry', `walk.problems[${index}]`)),
  };
}

export function walkLines(summary: WalkSummary): string[] {
  const looks: string[] = summary.looks.map((look: WalkLook): string => `${look.missing.length === 0 ? 'ok  ' : 'FAIL'} ${look.zone.padEnd(14)} +${String(look.afterMs).padStart(5)} ms  ${look.live - look.missing.length}/${look.live} drawn${look.missing.length === 0 ? '' : `  missing: ${look.missing.join(', ')}`}`);
  return [...looks, ...summary.problems.map((problem: string): string => `problem: ${problem}`), summary.ok ? 'BODY WALK OK: every live monster on the route was drawn' : 'BODY WALK FAILED'];
}
