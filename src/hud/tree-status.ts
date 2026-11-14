import type { Content, SkillTreeNodeDef } from '../../sim/content/types.ts';
import { canAllocate, joinBlock, refundBlock, rivalBlock } from '../../sim/progression.ts';
import type { JoinBlock, RefundBlock, RivalBlock } from '../../sim/progression.ts';
import { promptText, use } from './prompts.ts';

export const TREE_NODE_COST: number = 1;

export type GiveBackBlock = Exclude<RefundBlock, 'not_held'>;

export type TreeNodeStatus =
  | { readonly kind: 'allocated' }
  | { readonly kind: 'available' }
  | { readonly kind: 'no_points' }
  | { readonly kind: 'locked'; readonly needs: JoinBlock }
  | { readonly kind: 'rival'; readonly node: SkillTreeNodeDef; readonly skillName: string; readonly giveBack: GiveBackBlock | null };

export function treeNodeStatus(content: Content, allocated: readonly string[], skillPoints: number, node: SkillTreeNodeDef): TreeNodeStatus {
  if (allocated.includes(node.id)) return { kind: 'allocated' };
  const needs: JoinBlock | null = joinBlock(content, allocated, node);
  if (needs !== null) return { kind: 'locked', needs };
  const rival: RivalBlock | null = rivalBlock(content, allocated, node);
  if (rival !== null) {
    const block: RefundBlock | null = refundBlock(content, allocated, rival.node.id);
    return { kind: 'rival', node: rival.node, skillName: content.skills.get(rival.skill)?.name ?? rival.skill, giveBack: block === 'not_held' ? null : block };
  }
  return canAllocate(content, allocated, skillPoints, node.id) ? { kind: 'available' } : { kind: 'no_points' };
}

export function costLine(): string {
  return `Cost ${TREE_NODE_COST} skill point`;
}

const SETTLED_LINES: Readonly<Record<Exclude<TreeNodeStatus['kind'], 'locked' | 'rival'>, string>> = {
  allocated: 'Allocated',
  available: 'allocate',
  no_points: 'No skill points to spend',
};

const LOCKED_LINES: Readonly<Record<JoinBlock, string>> = {
  begin: 'Begin at a starting place first',
  connect: 'Connect to a place you hold',
  branch: 'Only your largest group of places can grow',
};

const GIVE_BACK_LINES: Readonly<Record<GiveBackBlock, string>> = {
  split: 'giving it back would cut off places beyond it',
  root: 'everything you hold grows from there',
};

function rivalLine(status: Extract<TreeNodeStatus, { readonly kind: 'rival' }>): string {
  const held: string = `You already hold ${status.node.name}, which changes ${status.skillName}`;
  return status.giveBack === null ? `${held}. Give it back to take this.` : `${held} · ${GIVE_BACK_LINES[status.giveBack]}`;
}

export function statusLine(status: TreeNodeStatus, touch: boolean): string {
  if (status.kind === 'locked') return LOCKED_LINES[status.needs];
  if (status.kind === 'rival') return rivalLine(status);
  if (status.kind === 'available') return promptText(touch, use(SETTLED_LINES.available));
  return SETTLED_LINES[status.kind];
}

const TAKEN_LINES: Readonly<Record<RefundBlock, string>> = {
  not_held: 'Taken',
  split: 'Taken · giving it back would cut off places beyond it',
  root: 'Taken · everything you hold grows from here',
};

export function takenLine(block: RefundBlock | null): string {
  return block === null ? 'Taken' : TAKEN_LINES[block];
}

export function lockedLine(status: TreeNodeStatus, steps: number, touch: boolean): string {
  const line: string = statusLine(status, touch);
  return steps > 0 ? `${line} · ${steps * TREE_NODE_COST} points along the lit route` : line;
}

export function pointsPrompt(points: number, held: number): string {
  if (held === 0) return 'Choose where you begin';
  return `${points} ${points === 1 ? 'point' : 'points'}: choose a place`;
}
