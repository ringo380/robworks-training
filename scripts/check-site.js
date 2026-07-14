#!/usr/bin/env node
/**
 * Site guard. Fails the build on:
 *   - unsupported factual claims in published HTML
 *   - non-standard dash characters in copy
 *   - unbalanced sentinel regions
 *   - malformed data/*.json
 * Exit 0 = pass, 1 = fail.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const DATA = path.join(ROOT, "data");

// These claims are not publicly substantiable, so the site names specific
// venues and engagements instead of asserting counts.
const NUM_WORD =
  "(?:dozens of|(?:twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|" +
  "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?)";
const BANNED = [
  {
    re: /\b\d{1,3}(?!\d)\+?\s*keynote(?:s|\s+engagements?)?\b|\bkeynotes?\b(?:\s+\w+)?\s*:\s*\d{1,3}(?!\d)/i,
    why: "A numeric keynote count claim is not defensible; name venues instead",
  },
  {
    re: new RegExp(`\\b${NUM_WORD}\\s+keynotes?\\b`, "i"),
    why: "A spelled-out keynote count claim is not defensible; name venues instead",
  },
  { re: /\b15\s*years?\b/i, why: '"15 years" of training is not supported (training roles start Apr 2015)' },
];
const BAD_DASHES = /[‒–—―]/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const failures = [];

let htmlFiles = [];
if (!fs.existsSync(DOCS)) {
  failures.push("docs/ directory not found - the guard has nothing to check; this is a hard failure");
} else {
  htmlFiles = walk(DOCS);
  if (htmlFiles.length === 0) {
    failures.push("docs/ contains no .html files - the guard checked nothing; this is a hard failure");
  }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  for (const { re, why } of BANNED) {
    if (re.test(html)) failures.push(`${rel}: ${why}`);
  }
  if (BAD_DASHES.test(html)) {
    failures.push(`${rel}: contains a non-standard dash; use the standard hyphen -`);
  }
  const begins = [...html.matchAll(/<!-- BEGIN:([A-Z-]+) -->/g)].map((m) => m[1]);
  const ends = [...html.matchAll(/<!-- END:([A-Z-]+) -->/g)].map((m) => m[1]);
  for (const b of begins) {
    if (!ends.includes(b)) failures.push(`${rel}: sentinel BEGIN:${b} has no matching END`);
  }
  for (const e of ends) {
    if (!begins.includes(e)) failures.push(`${rel}: sentinel END:${e} has no matching BEGIN`);
  }
}

if (fs.existsSync(DATA)) {
  for (const f of fs.readdirSync(DATA).filter((f) => f.endsWith(".json"))) {
    try {
      JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
    } catch (err) {
      failures.push(`data/${f}: invalid JSON - ${err.message}`);
    }
  }
} else {
  console.error("check-site: note - data/ directory not found; skipping JSON validation (expected until data files land in a later task)");
}

if (failures.length) {
  console.error("check-site FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("check-site OK");
