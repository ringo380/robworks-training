#!/usr/bin/env node
/**
 * Regenerates sentinel-bounded regions from data/*.json.
 *   docs/schools/index.html    <!-- BEGIN:OFFERINGS-SCHOOLS -->
 *   docs/companies/index.html  <!-- BEGIN:OFFERINGS-COMPANIES -->
 *   docs/speaking/index.html   <!-- BEGIN:TALKS -->
 *   docs/index.html            <!-- BEGIN:TESTIMONIALS -->
 * Idempotent: a second run produces zero diff.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const DATA = path.join(ROOT, "data");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function replaceBetween(html, begin, end, block) {
  const s = html.indexOf(begin);
  if (s === -1) throw new Error(`Missing sentinel ${begin}`);
  const e = html.indexOf(end, s + begin.length);
  if (e === -1) throw new Error(`Missing sentinel ${end} after ${begin}`);
  return html.slice(0, s + begin.length) + "\n" + block + "\n" + html.slice(e);
}

function renderOffering(o) {
  return `        <article class="row">
          <h3>${escapeHtml(o.title)}</h3>
          <p>${escapeHtml(o.summary)}</p>
          <p class="shape"><span aria-hidden="true">&rarr;</span> ${escapeHtml(o.shape)}</p>
        </article>`;
}

function renderTalks(talks, partner) {
  const t = talks
    .map(
      (x) => `        <li class="row">
          <h3>${escapeHtml(x.venue)}${x.year ? ` ${escapeHtml(x.year)}` : ""}</h3>${
        x.location ? `\n          <p>${escapeHtml(x.location)}</p>` : ""
      }
        </li>`
    )
    .join("\n");
  const p = partner
    .map((x) => `          <li>${escapeHtml(x.location)}</li>`)
    .join("\n");
  return `      <ul class="talks">
${t}
      </ul>
      <h3 class="partner-heading">On-site partner training</h3>
      <ul class="partner-list">
${p}
      </ul>`;
}

function renderTestimonials(items) {
  if (!items.length) {
    return `      <div class="empty-state">
        <p>References available on request.</p>
      </div>`;
  }
  return items
    .map(
      (q) => `      <figure class="row">
        <blockquote><p>${escapeHtml(q.quote)}</p></blockquote>
        <figcaption>${escapeHtml(q.name)}, ${escapeHtml(q.role)}, ${escapeHtml(q.org)}</figcaption>
      </figure>`
    )
    .join("\n");
}

function patch(file, begin, end, block) {
  const p = path.join(DOCS, file);
  let html = fs.readFileSync(p, "utf8");
  html = replaceBetween(html, begin, end, block);
  fs.writeFileSync(p, html);
  console.log(`docs/${file} - ${begin}`);
}

function main() {
  const { offerings } = readJson("offerings.json");
  const talksData = readJson("talks.json");
  const { testimonials } = readJson("testimonials.json");

  const schools = offerings.filter((o) => o.sector === "schools").map(renderOffering).join("\n\n");
  const companies = offerings.filter((o) => o.sector === "companies").map(renderOffering).join("\n\n");

  patch("schools/index.html", "<!-- BEGIN:OFFERINGS-SCHOOLS -->", "<!-- END:OFFERINGS-SCHOOLS -->", schools);
  patch("companies/index.html", "<!-- BEGIN:OFFERINGS-COMPANIES -->", "<!-- END:OFFERINGS-COMPANIES -->", companies);
  patch(
    "speaking/index.html",
    "<!-- BEGIN:TALKS -->",
    "<!-- END:TALKS -->",
    renderTalks(talksData.talks, talksData.partner_training)
  );
  patch("index.html", "<!-- BEGIN:TESTIMONIALS -->", "<!-- END:TESTIMONIALS -->", renderTestimonials(testimonials));
}

main();
