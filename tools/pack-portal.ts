import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PORTAL, checkLimits, describeReport, filesUnder, localRefs, megabytes } from './portal.ts';
import type { PortalFile, PortalReport } from './portal.ts';

const ROOT: string = resolve(import.meta.dirname, '..');
const OUT: string = join(ROOT, PORTAL.outDir);
const ZIP: string = join(ROOT, PORTAL.zip);
const ZIP_ARGS: readonly string[] = ['-q', '-r', '-D', '-X', '-FS', ZIP, '.'];

function fail(message: string): never {
  process.stderr.write(`portal: ${message}\n`);
  process.exit(1);
}

if (!existsSync(join(OUT, PORTAL.page.to))) fail(`no ${PORTAL.outDir}/${PORTAL.page.to}; run vite build --mode ${PORTAL.mode} first`);

const page: string = readFileSync(join(OUT, PORTAL.page.to), 'utf8');
const missing: readonly string[] = localRefs(page).filter((path: string): boolean => !existsSync(join(OUT, path)));
if (missing.length > 0) fail(`${PORTAL.page.to} points at files the build did not ship: ${missing.join(', ')}`);

const files: readonly PortalFile[] = filesUnder(OUT);
const report: PortalReport = checkLimits(files, PORTAL.limits);
process.stdout.write(`portal: ${PORTAL.outDir}/ holds ${describeReport(report)}\n`);
if (report.problems.length > 0) fail(`over the portal limits:\n  ${report.problems.join('\n  ')}`);

execFileSync('zip', ZIP_ARGS, { cwd: OUT, stdio: 'inherit' });
process.stdout.write(`portal: wrote ${PORTAL.zip} (${megabytes(statSync(ZIP).size)})\n`);
