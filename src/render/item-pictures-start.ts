import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Content } from '../../sim/content/types.ts';
import { frameOf } from '../../sim/wear.ts';
import type { CharacterNeeds } from '../../sim/wear.ts';
import { heroRig } from '../../sim/hero.ts';
import { createBrowserTimers } from '../browser-timers.ts';
import { warnInConsole } from '../backend/console-log.ts';
import type { CharacterLibrary, Dresser } from './character-loader.ts';
import { loadNeeds } from './character-loader.ts';
import type { ItemPictures } from './item-pictures.ts';
import { createItemPictures } from './item-pictures.ts';
import { createThumbnailStudio } from './item-thumbnails.ts';

export const PICTURES = {
  startMs: 50,
} as const;

export interface ItemPicturesStart {
  readonly content: Content;
  readonly library: CharacterLibrary;
  readonly loader: GLTFLoader;
  readonly dresser: Dresser;
  readonly hero: () => string | null;
  readonly refresh: () => void;
}

export function startItemPictures(start: ItemPicturesStart): ItemPictures {
  const { content, library } = start;
  return createItemPictures({
    content,
    studio: createThumbnailStudio(library, content.player.tint, createBrowserTimers()),
    load: (needs: CharacterNeeds): Promise<void> => loadNeeds(start.loader, content, start.dresser, library, needs),
    frame: (): string => frameOf(content, heroRig(content, start.hero())),
    schedule: (task: () => void): void => void window.setTimeout(task, PICTURES.startMs),
    painted: start.refresh,
    failed: (error: unknown): void => warnInConsole(`An item picture failed: ${String(error)}`),
  });
}
