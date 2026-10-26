/**
 * Dev-only: download pinned MIT libraries into vendor/.
 * Serving the site does not require this script.
 *
 *   node scripts/vendor.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TONAL_VERSION = "4.10.0";
const CHORDS_DB_VERSION = "0.5.1";
const ESBUILD_VERSION = "0.25.11";

const work = mkdtempSync(path.join(tmpdir(), "guitar-vendor-"));
console.log("temp", work);

execFileSync(
  "npm",
  [
    "install",
    "--silent",
    "--no-package-lock",
    `--prefix`,
    work,
    `@tonaljs/tonal@${TONAL_VERSION}`,
    `@tombatossals/chords-db@${CHORDS_DB_VERSION}`,
    `esbuild@${ESBUILD_VERSION}`,
  ],
  { stdio: "inherit" },
);

function licenseOf(pkgJsonPath) {
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const license = pkg.license || (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(",") : "");
  return { name: pkg.name, version: pkg.version, license };
}

function assertMit(pkgJsonPath) {
  const info = licenseOf(pkgJsonPath);
  const ok = /MIT/i.test(info.license);
  if (!ok) {
    throw new Error(`Refusing to vendor ${info.name}@${info.version}: license is ${info.license || "unknown"}`);
  }
  return info;
}

const tonalPkg = path.join(work, "node_modules", "@tonaljs", "tonal", "package.json");
const tonalInfo = assertMit(tonalPkg);
const tonalRoot = path.join(work, "node_modules", "@tonaljs");
const tonalDeps = readdirSync(tonalRoot).map((name) => assertMit(path.join(tonalRoot, name, "package.json")));

const chordsPkg = path.join(work, "node_modules", "@tombatossals", "chords-db", "package.json");
const chordsInfo = assertMit(chordsPkg);

const esbuild = path.join(work, "node_modules", "esbuild", "bin", "esbuild");
const entry = path.join(work, "entry.js");
writeFileSync(
  entry,
  `export { Chord, Note, Scale, Interval } from "@tonaljs/tonal";\n`,
);

const tonalOutDir = path.join(ROOT, "vendor", "tonal");
mkdirSync(tonalOutDir, { recursive: true });
execFileSync(
  esbuild,
  [
    entry,
    "--bundle",
    "--format=esm",
    "--minify",
    "--legal-comments=none",
    `--banner:js=/* @tonaljs/tonal ${TONAL_VERSION} (MIT). See ./LICENSE. Bundled for offline use; no CDN. */`,
    `--outfile=${path.join(tonalOutDir, "tonal.js")}`,
  ],
  { stdio: "inherit" },
);
cpSync(path.join(path.dirname(tonalPkg), "LICENSE"), path.join(tonalOutDir, "LICENSE"));
writeFileSync(
  path.join(tonalOutDir, "SOURCE.md"),
  sourceDoc({
    title: "tonal",
    npm: `@tonaljs/tonal@${TONAL_VERSION}`,
    repo: "https://github.com/tonaljs/tonal",
    license: "MIT",
    files: "tonal.js（由 esbuild 打包 Chord、Note、Scale、Interval）、LICENSE",
    notes: tonalDeps.map((d) => `- ${d.name}@${d.version}（${d.license}）`).join("\n"),
  }),
);

const guitar = JSON.parse(
  readFileSync(path.join(work, "node_modules", "@tombatossals", "chords-db", "lib", "guitar.json"), "utf8"),
);
const slim = slimGuitar(guitar);
const chordsOutDir = path.join(ROOT, "vendor", "chords-db");
mkdirSync(chordsOutDir, { recursive: true });
const guitarJs =
  `/* @tombatossals/chords-db ${CHORDS_DB_VERSION} guitar.json (MIT). See ./LICENSE. Offline subset: playable shapes, no slash chords. */\n` +
  `export const META = ${JSON.stringify({ version: CHORDS_DB_VERSION, tuning: slim.tuning })};\n` +
  `export const CHORDS = ${JSON.stringify(slim.chords)};\n`;
writeFileSync(path.join(chordsOutDir, "guitar.js"), guitarJs);
cpSync(path.join(path.dirname(chordsPkg), "LICENSE"), path.join(chordsOutDir, "LICENSE"));
writeFileSync(
  path.join(chordsOutDir, "SOURCE.md"),
  sourceDoc({
    title: "chords-db",
    npm: `@tombatossals/chords-db@${CHORDS_DB_VERSION}`,
    repo: "https://github.com/tombatossals/chords-db",
    license: "MIT",
    files: "guitar.js（標準調吉他按法）、LICENSE",
    notes: "只保留跨度 4 格以內、至少 3 個音的按法，並拿掉斜槓低音（/E、m/B 這類）。指法數字沿用原資料。",
  }),
);

const tonalBytes = readFileSync(path.join(tonalOutDir, "tonal.js")).length;
const guitarBytes = Buffer.byteLength(guitarJs);
console.log(`tonal.js ${tonalBytes} bytes; guitar.js ${guitarBytes} bytes`);
console.log(`licensed: ${tonalInfo.name}@${tonalInfo.version}, ${chordsInfo.name}@${chordsInfo.version}`);

rmSync(work, { recursive: true, force: true });

function sourceDoc({ title, npm, repo, license, files, notes }) {
  return `# ${title}\n\n- npm：\`${npm}\`\n- 來源：${repo}\n- 授權：${license}（全文見同目錄 LICENSE）\n- 本目錄檔案：${files}\n\n${notes}\n`;
}

function absFret(fret, baseFret) {
  if (fret === -1) return null;
  if (fret === 0) return 0;
  return baseFret + fret - 1;
}

function spanOf(frets) {
  const sounded = frets.filter((f) => typeof f === "number" && f > 0);
  if (sounded.length === 0) return 1;
  return Math.max(...sounded) - Math.min(...sounded) + 1;
}

function slimGuitar(guitar) {
  const chords = {};
  for (const [key, list] of Object.entries(guitar.chords)) {
    chords[key] = {};
    for (const chord of list) {
      if (chord.suffix.includes("/")) continue;
      const positions = [];
      for (const pos of chord.positions) {
        const frets = pos.frets.map((f) => absFret(f, pos.baseFret));
        const sounded = frets.filter((f) => f !== null);
        if (sounded.length < 3) continue;
        if (spanOf(frets) > 4) continue;
        if (Math.max(...sounded.filter((f) => f > 0), 0) > 15) continue;
        const fingers = (pos.fingers || []).map((f, i) => (frets[i] === null || frets[i] === 0 ? 0 : f));
        const barres = (pos.barres || []).map((b) => pos.baseFret + b - 1);
        positions.push({ frets, fingers, barres });
        if (positions.length >= 8) break;
      }
      if (positions.length) chords[key][chord.suffix] = positions;
    }
  }
  return { tuning: guitar.tunings.standard, chords };
}
