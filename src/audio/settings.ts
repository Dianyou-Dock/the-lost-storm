export const AUDIO_CATEGORIES = ['master', 'effects', 'voice', 'ambience'] as const;
export type AudioCategory = (typeof AUDIO_CATEGORIES)[number];

export interface AudioSettings {
  readonly volumes: Readonly<Record<AudioCategory, number>>;
  readonly muted: boolean;
}

export interface SettingsStorage {
  read(): string | null;
  write(text: string): void;
}

export interface AudioControls {
  get(): AudioSettings;
  setVolume(category: AudioCategory, value: number): void;
  setMuted(muted: boolean): void;
  subscribe(listener: (settings: AudioSettings) => void): void;
}

export const DEFAULT_SETTINGS: AudioSettings = {
  volumes: { master: 0.8, effects: 0.8, voice: 1, ambience: 0.6 },
  muted: false,
};

export const PORTAL_SETTINGS: AudioSettings = { ...DEFAULT_SETTINGS, muted: true };

const SETTINGS_KEY: string = 'the-lost-storm.audio.v1';
const PORTAL_SETTINGS_KEY: string = 'the-lost-storm.audio.portal.v1';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fieldOf(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) return undefined;
  return Object.entries(source).find(([name]: [string, unknown]): boolean => name === key)?.[1];
}

function volumeOf(source: unknown, category: AudioCategory, defaults: AudioSettings): number {
  const value: unknown = fieldOf(source, category);
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : defaults.volumes[category];
}

export function voiceAudible(settings: AudioSettings): boolean {
  return !settings.muted && settings.volumes.master > 0 && settings.volumes.voice > 0;
}

export function parseSettings(text: string | null, defaults: AudioSettings = DEFAULT_SETTINGS): AudioSettings {
  if (text === null) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return defaults;
  }
  const volumes: unknown = fieldOf(parsed, 'volumes');
  const muted: unknown = fieldOf(parsed, 'muted');
  return {
    volumes: {
      master: volumeOf(volumes, 'master', defaults),
      effects: volumeOf(volumes, 'effects', defaults),
      voice: volumeOf(volumes, 'voice', defaults),
      ambience: volumeOf(volumes, 'ambience', defaults),
    },
    muted: typeof muted === 'boolean' ? muted : defaults.muted,
  };
}

export function createSettingsStore(storage: SettingsStorage, defaults: AudioSettings = DEFAULT_SETTINGS): AudioControls {
  let settings: AudioSettings = parseSettings(storage.read(), defaults);
  const listeners: ((settings: AudioSettings) => void)[] = [];
  const commit = (next: AudioSettings): void => {
    settings = next;
    storage.write(JSON.stringify(next));
    for (const listener of listeners) listener(next);
  };
  return {
    get(): AudioSettings {
      return settings;
    },
    setVolume(category: AudioCategory, value: number): void {
      const next: number = clamp01(value);
      if (settings.volumes[category] === next) return;
      commit({ ...settings, volumes: { ...settings.volumes, [category]: next } });
    },
    setMuted(muted: boolean): void {
      if (settings.muted === muted) return;
      commit({ ...settings, muted });
    },
    subscribe(listener: (next: AudioSettings) => void): void {
      listeners.push(listener);
    },
  };
}

export function browserSettingsStorage(portal: boolean = false): SettingsStorage {
  const key: string = portal ? PORTAL_SETTINGS_KEY : SETTINGS_KEY;
  return {
    read(): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(text: string): void {
      try {
        window.localStorage.setItem(key, text);
      } catch {
        return;
      }
    },
  };
}
