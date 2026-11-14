import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin, ResolvedConfig, Rollup } from 'vite';

export const PORTAL = {
  mode: 'portal',
  outDir: 'dist-portal',
  zip: 'the-lost-storm-portal.zip',
  page: { from: 'play/index.html', to: 'index.html' },
  withheldEnv: ['VITE_SERVER_URL', 'VITE_ASSET_BASE'],
  privateFolders: ['models/local/', 'audio/local/'],
  siteOnly: ['privacy.html', 'terms.html', 'og.jpg'],
  limits: { files: 1000, totalBytes: 500 * 1024 * 1024, fileBytes: 200 * 1024 * 1024 },
} as const;

export interface PortalFile {
  readonly path: string;
  readonly bytes: number;
}

export interface PortalLimits {
  readonly files: number;
  readonly totalBytes: number;
  readonly fileBytes: number;
}

export interface PortalReport {
  readonly files: number;
  readonly totalBytes: number;
  readonly problems: readonly string[];
}

const PARENT_REF: RegExp = /(\s(?:src|href)=")\.\.\//g;
const PUBLIC_REF: RegExp = /(\s(?:src|href)=")\/(?!\/)/g;
const LOCAL_REF: RegExp = /\s(?:src|href)="\.\/([^"?#]+)/g;
const LEFT_PARENT: RegExp = /\s(?:src|href)="(?![a-z]+:|\/\/)[^"]*\.\.\/[^"]*"/;
const ROOT_REF: RegExp = /\s(?:src|href)="\/(?!\/)[^"]*"/;
const SITE_ANCHOR: RegExp = /<a\b([^>]*?)\shref="\/(?!\/)([^"]*)"([^>]*)>/g;
const MEGABYTE: number = 1024 * 1024;

export function liftPage(html: string): string {
  const lifted: string = html.replace(PARENT_REF, '$1./').replace(PUBLIC_REF, '$1./');
  const above: RegExpExecArray | null = LEFT_PARENT.exec(lifted);
  if (above !== null) throw new Error(`the portal page still points above its own folder:${above[0]}`);
  const rooted: RegExpExecArray | null = ROOT_REF.exec(lifted);
  if (rooted !== null) throw new Error(`the portal page still has a root-relative URL:${rooted[0]}`);
  return lifted;
}

export function localRefs(html: string): readonly string[] {
  return [...html.matchAll(LOCAL_REF)].map((match: RegExpExecArray): string => match[1] ?? '');
}

export function siteAnchors(html: string, site: string): string {
  const root: string = site.endsWith('/') ? site.slice(0, -1) : site;
  return html.replace(SITE_ANCHOR, (_match: string, before: string, path: string, after: string): string => `<a${before} href="${root}/${path}" target="_blank" rel="noopener"${after}>`);
}

export function shipsInPortal(path: string): boolean {
  if (PORTAL.privateFolders.some((folder: string): boolean => path.startsWith(folder))) return false;
  return !PORTAL.siteOnly.some((file: string): boolean => path === file);
}

export function withheldSet(env: Readonly<Record<string, unknown>>): readonly string[] {
  return PORTAL.withheldEnv.filter((key: string): boolean => {
    const value: unknown = env[key];
    return typeof value === 'string' && value.trim() !== '';
  });
}

export function megabytes(bytes: number): string {
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

export function checkLimits(files: readonly PortalFile[], limits: PortalLimits): PortalReport {
  const totalBytes: number = files.reduce((sum: number, file: PortalFile): number => sum + file.bytes, 0);
  const problems: string[] = [];
  if (files.length > limits.files) problems.push(`${files.length} files, more than the ${limits.files} allowed`);
  if (totalBytes > limits.totalBytes) problems.push(`${megabytes(totalBytes)} in all, more than the ${megabytes(limits.totalBytes)} allowed`);
  for (const file of files) {
    if (file.bytes > limits.fileBytes) problems.push(`${file.path} is ${megabytes(file.bytes)}, more than the ${megabytes(limits.fileBytes)} allowed for one file`);
  }
  return { files: files.length, totalBytes, problems };
}

export function describeReport(report: PortalReport): string {
  return `${report.files} files, ${megabytes(report.totalBytes)}`;
}

export function filesUnder(dir: string): PortalFile[] {
  const walk = (folder: string): PortalFile[] =>
    readdirSync(folder)
      .toSorted()
      .flatMap((name: string): PortalFile[] => {
        const path: string = join(folder, name);
        const stats = statSync(path);
        return stats.isDirectory() ? walk(path) : [{ path: relative(dir, path).split(sep).join('/'), bytes: stats.size }];
      });
  return walk(dir);
}

export function portalPage(publicDir: string, site: string): Plugin {
  return {
    name: 'lost-storm-portal',
    enforce: 'post',
    configResolved(config: ResolvedConfig): void {
      const set: readonly string[] = withheldSet(config.env);
      if (set.length > 0) throw new Error(`the portal build runs with no server: unset ${set.join(' and ')}`);
    },
    transformIndexHtml(html: string): string {
      return siteAnchors(html, site);
    },
    generateBundle(_options: Rollup.NormalizedOutputOptions, bundle: Rollup.OutputBundle): void {
      const page: Rollup.OutputAsset | Rollup.OutputChunk | undefined = bundle[PORTAL.page.from];
      if (page?.type !== 'asset' || typeof page.source !== 'string') throw new Error(`the portal build made no ${PORTAL.page.from}`);
      const source: string = page.source;
      Reflect.deleteProperty(bundle, PORTAL.page.from);
      this.emitFile({ type: 'asset', fileName: PORTAL.page.to, source: liftPage(source) });
      for (const file of filesUnder(publicDir)) {
        if (shipsInPortal(file.path)) this.emitFile({ type: 'asset', fileName: file.path, source: readFileSync(join(publicDir, file.path)) });
      }
    },
  };
}
