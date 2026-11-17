// Hand-in for Lumen Drift — Starlight Salvage (best-game-01, Node 22, standard
// library only). The judge runs this one file, and it alone decides what the judge
// sees: it gathers the playable game and its screenshots into the output
// directory, then asks the vendored make.fun library to describe that directory
// as dossier.json, the summary the judge reads. The game itself is plain static
// files under game/ that a desktop browser loads offline; nothing in this file
// touches the network.
//
// To run it outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The entry lives where this file lives. The hand-in goes to the directory
// named by MAKEFUN_OUTPUT_DIR, or to /output inside the grader.
const entryRoot = fileURLToPath(new URL('.', import.meta.url));
const handInDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, taken from the competition's gate. Only text_max_bytes
// changes the dossier's bytes. The rest make this program fail exactly where
// the scorer would refuse the entry — more than 4 screenshots, one over
// 256 KiB, more than 993 files or 48 MiB under game/, or a game path over
// 1000 bytes — because game/ shares /output's 1000-entry cap with
// screenshots/ and dossier.json.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Move one folder from the entry into the hand-in, creating the target first.
// A folder marked optional may be missing from the entry; then only the empty
// target folder is left behind.
function stage(folder: string, optional = false): void {
  const from = join(entryRoot, folder);
  const to = join(handInDir, folder);
  mkdirSync(to, { recursive: true });
  if (!optional || existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(handInDir, { recursive: true });
stage('game');
stage('screenshots', true);
writeFileSync(join(handInDir, 'dossier.json'), buildDossier(handInDir, dossierCaps));
