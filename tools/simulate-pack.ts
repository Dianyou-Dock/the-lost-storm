export const PACK = {
  count: 4,
  repeats: 5,
} as const;

export interface PackFight {
  readonly kind: 'pack';
  readonly monster: string;
  readonly count: number;
  readonly levels: readonly number[];
  readonly repeats: number;
  readonly minutes: number;
}

export function packFoe(fight: Pick<PackFight, 'monster' | 'count'>): string {
  return `${fight.count} ${fight.monster}`;
}
