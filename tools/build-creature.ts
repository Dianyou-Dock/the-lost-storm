import type { Document } from '@gltf-transform/core';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MaterialFix } from './creature-model.ts';
import { clipNamesOf, dropClips, fixMaterials, keepOnlyClip } from './creature-model.ts';

async function writeBody(io: NodeIO, source: string, target: string): Promise<readonly MaterialFix[]> {
  const document: Document = await io.read(source);
  const fixed: readonly MaterialFix[] = fixMaterials(document);
  dropClips(document);
  await document.transform(prune({ keepLeaves: true }));
  mkdirSync(dirname(target), { recursive: true });
  await io.write(target, document);
  return fixed;
}

async function writeClip(io: NodeIO, source: string, folder: string, name: string): Promise<string> {
  const document: Document = await io.read(source);
  keepOnlyClip(document, name);
  await document.transform(prune({ keepLeaves: true }));
  const target: string = join(folder, `${name}.glb`);
  await io.write(target, document);
  return target;
}

async function main(): Promise<void> {
  const [source, body, folder, ...rest] = process.argv.slice(2);
  if (source === undefined || body === undefined || folder === undefined || rest.length > 0) {
    console.error('usage: node tools/build-creature.ts <creature.gltf|glb> <body.glb> <clip-folder>');
    process.exit(2);
  }
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io: NodeIO = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const names: readonly string[] = clipNamesOf(await io.read(source));
  mkdirSync(folder, { recursive: true });
  const fixed: readonly MaterialFix[] = await writeBody(io, source, body);
  const clips: readonly string[] = await Promise.all(names.map((name: string): Promise<string> => writeClip(io, source, folder, name)));
  for (const fix of fixed) console.log(`${fix.name}: ${fix.opacity ? 'made opaque' : ''}${fix.opacity && fix.emissive ? ', ' : ''}${fix.emissive ? 'emissive cleared' : ''}`);
  console.log(`${source} -> ${body}, ${clips.length} clips into ${folder}`);
}

await main();
