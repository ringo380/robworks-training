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

// Claims that are NOT supported by the evidence vault. See career.md.
const BANNED = [
  { re: /\b25\+?\s*keynote/i, why: '"25+ keynotes" is not supported (~6-8 talks confirmed)' },
  { re: /\b1[2-9]\+?\s*keynote/i, why: "A keynote count claim is not defensible; name venues instead" },
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

for (const file of walk(DOCS)) {
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
}

if (fs.existsSync(DATA)) {
  for (const f of fs.readdirSync(DATA).filter((f) => f.endsWith(".json"))) {
    try {
      JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
    } catch (err) {
      failures.push(`data/${f}: invalid JSON - ${err.message}`);
    }
  }
}

if (failures.length) {
  console.error("check-site FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("check-site OK");
