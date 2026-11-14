import type { Condition } from './condition-types.ts';
import type { StoryFlags } from './story-types.ts';

export interface SceneLead {
  readonly exit: string;
  readonly x: number;
  readonly z: number;
  readonly ahead: number;
  readonly walk: number;
  readonly run: number;
  readonly through: number | null;
}

export interface SceneDef {
  readonly id: string;
  readonly npc: string;
  readonly when: readonly Condition[];
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly moment: string;
  readonly fight: number;
  readonly arrive: number;
  readonly strike: string;
  readonly lines: readonly string[];
  readonly lead: SceneLead;
  readonly sets: StoryFlags;
}
