import type { BoardRow, Leaderboard, LevelUpNote, NameRefusal, Ranking } from '../backend/api.ts';
import { DAMAGE_EXPLAINED } from '../../sim/ladder.ts';

export interface RankingTab {
  readonly by: Ranking;
  readonly label: string;
  readonly caption: string;
}

export const RANKING_TABS: readonly RankingTab[] = [
  { by: 'level', label: 'Level', caption: 'Highest level reached, then experience' },
  { by: 'damage', label: 'Damage', caption: DAMAGE_EXPLAINED },
  { by: 'life', label: 'Life', caption: 'Maximum life' },
];

const GROUPED: Intl.NumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function wholeText(value: number): string {
  return GROUPED.format(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
}

export function rankValue(row: BoardRow, by: Ranking): number {
  switch (by) {
    case 'level':
      return row.level;
    case 'damage':
      return row.damage;
    case 'life':
      return row.life;
  }
  return row.level;
}

export function rankValueText(row: BoardRow, by: Ranking): string {
  return wholeText(rankValue(row, by));
}

export function tabOf(by: Ranking): RankingTab {
  return RANKING_TABS.find((tab: RankingTab): boolean => tab.by === by) ?? { by, label: by, caption: '' };
}

export type NameProblem = NameRefusal | 'limited' | 'unavailable';

export const NAME_RULES: { readonly min: number; readonly max: number } = { min: 3, max: 16 };

export const NAME_MESSAGES: Readonly<Record<NameProblem, string>> = {
  name_length: `Use ${NAME_RULES.min} to ${NAME_RULES.max} characters.`,
  name_characters: 'Letters, digits and single spaces only.',
  name_blocked: 'That name is not allowed.',
  name_taken: 'Someone already has that name.',
  limited: 'Too many name changes for now. Try again in an hour.',
  unavailable: 'The ladder is out of reach. Try again in a moment.',
};

const ALLOWED: RegExp = /^[A-Za-z0-9 ]+$/;
const LETTER: RegExp = /[A-Za-z]/;
const SPACES: RegExp = /\s+/g;
const MINUTES_PER_HOUR: number = 60;
const HOURS_PER_DAY: number = 24;

export function tidyName(raw: string): string {
  return raw.trim().replaceAll(SPACES, ' ');
}

export function nameProblem(raw: string): NameRefusal | null {
  const name: string = tidyName(raw);
  if (name.length < NAME_RULES.min || name.length > NAME_RULES.max) return 'name_length';
  if (!ALLOWED.test(name) || !LETTER.test(name)) return 'name_characters';
  return null;
}

export function agoText(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours: number = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;
  return `${Math.floor(hours / HOURS_PER_DAY)}d ago`;
}

export function levelUpText(note: LevelUpNote): string {
  return `${note.name} reached level ${note.level}`;
}

export function onlineText(count: number): string {
  return `${count} online`;
}

export function charactersText(count: number): string {
  return count === 1 ? '1 character' : `${count} characters`;
}

export function rankText(rank: number): string {
  return `#${rank}`;
}

function rankIn(board: Leaderboard, name: string): number | null {
  return board.top.find((row: BoardRow): boolean => row.name === name)?.rank ?? null;
}

export function passedNames(previous: Leaderboard | null, next: Leaderboard): readonly string[] {
  if (previous === null || previous.you === null || next.you === null) return [];
  if (previous.you.name !== next.you.name || next.you.rank >= previous.you.rank) return [];
  const before: number = previous.you.rank;
  const after: number = next.you.rank;
  const lowest: number = next.top.reduce((most: number, row: BoardRow): number => Math.max(most, row.rank), 0);
  return previous.top
    .filter((row: BoardRow): boolean => row.name !== next.you?.name && row.rank < before)
    .filter((row: BoardRow): boolean => {
      const now: number | null = rankIn(next, row.name);
      return now === null ? after <= lowest : now > after;
    })
    .map((row: BoardRow): string => row.name);
}

export function shownKey(board: Leaderboard, slots: number): string {
  const rows: readonly (string | number | boolean | null)[][] = board.top.slice(0, slots).map((row: BoardRow): (string | number | boolean | null)[] => [row.rank, row.name, row.furthest, rankValueText(row, board.by), row.online, row.account]);
  const you: readonly (string | number | boolean)[] | null = board.you === null ? null : [board.you.rank, board.you.name, board.you.furthest, rankValueText(board.you, board.by), board.you.chosen];
  const notes: readonly string[] = board.levelUps.map((note: LevelUpNote): string => `${levelUpText(note)} ${agoText(note.minutesAgo)}`);
  return JSON.stringify([board.by, rows, you, onlineText(board.online), notes]);
}

export function asksForName(board: Leaderboard): boolean {
  return board.you === null || !board.you.chosen;
}

export function spokenName(board: Leaderboard | null): string | null {
  if (board === null || board.you === null || !board.you.chosen) return null;
  return board.you.name;
}
