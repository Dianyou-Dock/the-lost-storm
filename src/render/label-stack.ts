import { LABEL_EDGE } from './label-edge.ts';

export const SETTLE = {
  downWeight: 4,
} as const;

export interface LabelBox {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface LabelSpot {
  readonly x: number;
  readonly y: number;
}

export interface SettleView {
  readonly width: number;
  readonly height: number;
}

function rectOf(box: LabelBox, x: number, y: number): ScreenRect {
  return { left: x - box.width / 2, top: y - box.height, right: x + box.width / 2, bottom: y };
}

function touches(a: ScreenRect, b: ScreenRect, gap: number): boolean {
  return a.left < b.right + gap && b.left - gap < a.right && a.top < b.bottom + gap && b.top - gap < a.bottom;
}

function centred(x: number, width: number, view: SettleView): number {
  const low: number = LABEL_EDGE.side + width / 2;
  const high: number = view.width - LABEL_EDGE.side - width / 2;
  return low > high ? view.width / 2 : Math.min(high, Math.max(low, x));
}

export function settleLabels(boxes: readonly RankedBox[], gap: number, view: SettleView, blockers: readonly ScreenRect[]): Map<number, LabelSpot> {
  const ordered: RankedBox[] = boxes.toSorted((a: RankedBox, b: RankedBox): number => (a.rank !== b.rank ? b.rank - a.rank : a.y !== b.y ? b.y - a.y : a.id - b.id));
  const placed: ScreenRect[] = [];
  const spots: Map<number, LabelSpot> = new Map<number, LabelSpot>();
  const hudGap: number = LABEL_EDGE.hudGap + 1;
  for (const box of ordered) {
    const free = (x: number, y: number): boolean => {
      if (y - box.height < LABEL_EDGE.topClear || y > view.height - LABEL_EDGE.side) return false;
      const rect: ScreenRect = rectOf(box, x, y);
      return !placed.some((other: ScreenRect): boolean => touches(rect, other, gap)) && !blockers.some((other: ScreenRect): boolean => touches(rect, other, LABEL_EDGE.hudGap));
    };
    const ys: number[] = [box.y, ...placed.flatMap((rect: ScreenRect): number[] => [rect.top - gap, rect.bottom + gap + box.height]), ...blockers.flatMap((rect: ScreenRect): number[] => [rect.top - hudGap, rect.bottom + hudGap + box.height])];
    const home: number = centred(box.x, box.width, view);
    const lean = (x: number, y: number): number => Math.abs(x - home) + (y <= box.y ? box.y - y : (y - box.y) * SETTLE.downWeight);
    const pick = (xs: readonly number[]): LabelSpot | null => {
      let best: LabelSpot | null = null;
      let cost: number = Infinity;
      for (const raw of xs) {
        const x: number = centred(raw, box.width, view);
        for (const y of ys) {
          const option: number = lean(x, y);
          if (option < cost && free(x, y)) {
            cost = option;
            best = { x, y };
          }
        }
      }
      return best;
    };
    const sides: number[] = [...placed, ...blockers].flatMap((rect: ScreenRect): number[] => [rect.left - gap - box.width / 2 - LABEL_EDGE.hudGap, rect.right + gap + box.width / 2 + LABEL_EDGE.hudGap]);
    const spot: LabelSpot = pick([home]) ?? pick([home, ...sides]) ?? { x: home, y: Math.min(view.height - LABEL_EDGE.side, Math.max(LABEL_EDGE.topClear + box.height, box.y)) };
    placed.push(rectOf(box, spot.x, spot.y));
    spots.set(box.id, spot);
  }
  return spots;
}

export interface RankedBox extends LabelBox {
  readonly rank: number;
}

export interface Folding {
  readonly folded: ReadonlySet<number>;
  readonly more: ReadonlyMap<number, number>;
}

export function foldPiles(boxes: readonly RankedBox[], reach: number, keep: number): Folding {
  const groupOf: Map<number, number> = new Map<number, number>();
  const find = (id: number): number => {
    let root: number = id;
    for (let next: number | undefined = groupOf.get(root); next !== undefined && next !== root; next = groupOf.get(root)) root = next;
    return root;
  };
  for (const box of boxes) groupOf.set(box.id, box.id);
  boxes.forEach((a: RankedBox, index: number): void => {
    for (const b of boxes.slice(index + 1)) {
      if (Math.hypot(a.x - b.x, a.y - b.y) <= reach) groupOf.set(find(a.id), find(b.id));
    }
  });
  const groups: Map<number, RankedBox[]> = new Map<number, RankedBox[]>();
  for (const box of boxes) {
    const root: number = find(box.id);
    groups.set(root, [...(groups.get(root) ?? []), box]);
  }
  const folded: Set<number> = new Set<number>();
  const more: Map<number, number> = new Map<number, number>();
  for (const members of groups.values()) {
    if (members.length <= keep) continue;
    const ordered: RankedBox[] = members.toSorted((a: RankedBox, b: RankedBox): number => (b.rank === a.rank ? a.id - b.id : b.rank - a.rank));
    const hidden: RankedBox[] = ordered.slice(keep);
    for (const box of hidden) folded.add(box.id);
    const last: RankedBox | undefined = ordered[keep - 1];
    if (last !== undefined) more.set(last.id, hidden.length);
  }
  return { folded, more };
}
