// Cover Snap — entrypoint for the gta6-cover-art-01 bounty.
//
// Cover Snap is a browser-side GTA 6 style cover studio: load a photo,
// choose one of five color grades and one of four panel layouts, then
// export a high-resolution cover. Everything under app/ is static and
// runs offline; this file only packages it.
//
// Packaging matches the make.fun starter: copy app/ and screenshots/
// from beside this file into /output (or MAKEFUN_OUTPUT_DIR when set),
// then write dossier.json through buildDossier with the scorer's caps.
//
// Local preview: `node serve.ts`, then open http://localhost:8080.
// Outside the grader: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const appDir = join(here, 'app');
const screenshotsDir = join(here, 'screenshots');

console.error(`[cover-snap] starting; output directory: ${out}`);

// Warn before packaging so a missing app or an oversized screenshot is
// visible in the log even when the later copy or scorer check fails.
if (!existsSync(appDir)) {
  console.error('[cover-snap] warning: app/ is missing; there is nothing to package.');
}

function oversizedScreenshots(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && statSync(child).size > 262144) found.push(child);
    }
  };
  visit(dir);
  return found;
}

for (const file of oversizedScreenshots(screenshotsDir)) {
  console.error(`[cover-snap] warning: screenshot exceeds 262144 bytes: ${file}`);
}

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(screenshotsDir)) cpSync(screenshotsDir, join(out, 'screenshots'), { recursive: true });

// Same caps as the starter and the scorer's reference/gate.json: only
// text_max_bytes shapes the bytes; the rest reject entries the scorer
// would reject (4 screenshots at 256 KiB each; 993 app files totaling
// 48 MiB; 1000-byte paths under app/).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
