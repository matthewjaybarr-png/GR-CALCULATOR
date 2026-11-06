#!/usr/bin/env node
/*
 * build-reference.js — generate the printable reference sheet and CSV tables straight from js/data.js.
 *
 * Usage (from the repo root, or pass the repo root as the first argument):
 *   node tools/build-reference.js [repoRoot] [outDir]
 *
 * Outputs (in outDir, default ./dist/reference):
 *   Sine-Reference-Sheet.html        print-friendly: formulas, tap drills, drill sizes, SFM baselines
 *   tap-drills.csv                 every UNC / UNF / NPT / metric row, with approx. thread % and a check flag
 *   drill-sizes.csv                fractional, number, letter and metric drills with decimal inch + mm
 *   material-sfm-baselines.csv     MB baseline low / standard / upper SFM by material and operation
 *
 * Nothing is retyped: every number comes from js/data.js, so the sheet cannot drift from the calculator.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const outDir = path.resolve(process.argv[3] || path.join(root, "dist", "reference"));
const data = require(path.join(root, "js/data.js"));
const core = require(path.join(root, "js/core.js"));
fs.mkdirSync(outDir, { recursive: true });

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const csvCell = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => rows.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n"; // CRLF so Excel/Notepad behave on shop PCs
const fix = (v, d) => Number(v).toFixed(d);
const mm = inches => inches * 25.4;

// ---------- drill sizes ----------
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function fraction64(n) {
  const whole = Math.floor(n / 64), rem = n % 64;
  if (!rem) return String(whole);
  const g = gcd(rem, 64);
  return (whole ? whole + " " : "") + rem / g + "/" + 64 / g;
}
const drills = [];
for (let n = 1; n <= 128; n++) drills.push({ type: "fractional", name: fraction64(n), dec: n / 64 });
data.numberDrills.forEach(([name, dec]) => drills.push({ type: "number", name, dec }));
data.letterDrills.forEach(([name, dec]) => drills.push({ type: "letter", name, dec }));
data.metricDrills.forEach(([name, dec]) => drills.push({ type: "metric", name, dec }));
drills.sort((a, b) => a.dec - b.dec);

// ---------- tap drills ----------
const TOL = 0.0005; // inch; ignores rounding on chart sizes that sit exactly on 65% / 80%
const tapRows = [];
for (const [series, list] of Object.entries(data.threads)) {
  for (const t of list) {
    const metric = series === "METRIC";
    let pct = "", check = "";
    if (series !== "NPT") {
      const pitchLen = metric ? t.pitch : 1 / t.pitch;
      const major = metric ? t.major : t.major;
      const dia = metric ? t.tapDec * 25.4 : t.tapDec;
      pct = ((major - dia) / (1.299038 * pitchLen) * 100).toFixed(0);
      const r = core.tapDrillRange(series, t, "cut");
      if (t.tapDec < r.minDec - TOL || t.tapDec > r.maxDec + TOL) {
        check = "VERIFY: listed drill is outside the 65-80% thread range this calculator computes";
      }
    } else if (t.tapConfidence !== "published") {
      check = "Reference value - verify with the tap manufacturer";
    }
    tapRows.push({
      series, thread: t.thread,
      major: metric ? t.major + " mm" : fix(t.major, 4) + " in",
      pitch: metric ? t.pitch + " mm" : t.pitch + " TPI",
      tap: t.tap, dec: t.tapDec, pct, confidence: t.tapConfidence || "", check,
    });
  }
}

// ---------- CSV files ----------
fs.writeFileSync(path.join(outDir, "tap-drills.csv"), "﻿" + csv([
  ["series", "thread", "major", "pitch", "tap_drill", "tap_drill_decimal_in", "tap_drill_mm", "approx_thread_pct", "data_confidence", "check"],
  ...tapRows.map(r => [r.series, r.thread, r.major, r.pitch, r.tap, fix(r.dec, 4), fix(mm(r.dec), 3), r.pct, r.confidence, r.check]),
]));
fs.writeFileSync(path.join(outDir, "drill-sizes.csv"), "﻿" + csv([
  ["type", "name", "decimal_in", "mm"],
  ...drills.map(d => [d.type, d.name, fix(d.dec, 4), fix(mm(d.dec), 3)]),
]));
const sfmRows = [["material_id", "material", "iso_group", "operation", "low_sfm", "standard_sfm", "upper_sfm", "source"]];
for (const m of data.materials) {
  for (const [op, r] of Object.entries(m.sfm)) sfmRows.push([m.id, m.name, m.isoGroup, op, r[0], r[1], r[2], data.provenance.baseline.label]);
}
fs.writeFileSync(path.join(outDir, "material-sfm-baselines.csv"), "﻿" + csv(sfmRows));

// ---------- printable HTML sheet ----------
const ops = [
  ["drillHss", "Drill HSS"], ["drillCarbide", "Drill carbide"], ["endmillCarbide", "End mill carbide"],
  ["indexableMill", "Indexable mill"], ["turnCarbide", "Turn carbide"], ["boreCarbide", "Bore carbide"],
  ["grooveCarbide", "Groove carbide"], ["tapHss", "Tap HSS"], ["tapCarbide", "Tap carbide"],
];
const formulas = [
  ["Spindle speed", "RPM = SFM × 12 ÷ (π × D) &nbsp;≈&nbsp; SFM × 3.8197 ÷ D (D in inches)"],
  ["Surface speed", "SFM = RPM × π × D ÷ 12"],
  ["Feed — drilling / turning", "IPM = RPM × IPR"],
  ["Feed — milling / thread mill", "IPM = RPM × teeth × FPT"],
  ["Radial chip thinning", "factor = 1 ÷ √(1 − (1 − 2·ae/D)²) when ae &lt; 0.5·D, otherwise 1.  Small ae gives large factors (ae = 0.05·D → 2.29×) — cap it."],
  ["Tapping feed (rigid)", "IPM = RPM × pitch = RPM ÷ TPI"],
  ["Tap drill, straight thread", "Drill = Major − 1.299038 × pitch × %thread (pitch = 1 ÷ TPI for inch). Calculator range: 65%–80%, typical 75% (form tap 45%–65%, typical 55%)."],
  ["Countersink / chamfer depth", "Depth = ((major Ø − hole Ø) ÷ 2) ÷ tan(included angle ÷ 2)"],
  ["Drill point depth", "Depth = (D ÷ 2) ÷ tan(point angle ÷ 2)"],
  ["Circular interpolation", "Centerline Ø = feature Ø − tool Ø (internal) or + tool Ø (external). Centerline feed = surface feed × centerline Ø ÷ feature Ø"],
  ["Thread mill centerline", "Path Ø = thread major − tool Ø (internal) or + tool Ø (external)"],
  ["Helix ramp", "Pitch = π × (bore − tool) × tan(helix angle)"],
  ["Ball-nose effective Ø", "De = 2 × √(ap × (D − ap)) for ap &lt; D ÷ 2, otherwise D"],
  ["Scallop height / stepover", "h = R − √(R² − (ae ÷ 2)²) &nbsp;·&nbsp; ae = 2 × √(2·R·h − h²)   (R = ball radius)"],
  ["True position (diametrical)", "TP = 2 × √(ΔX² + ΔY²)"],
  ["Taper", "Per-side angle = atan((D − d) ÷ (2 × L))"],
  ["NPT taper", "0.0625 in/in on diameter (¾ in/ft), 1.7899° per side"],
  ["Conversions", "1 in = 25.4 mm · SFM × 0.3048 = m/min"],
];
const tapSection = Object.keys(data.threads).map(series => {
  const rows = tapRows.filter(r => r.series === series).map(r =>
    `<tr${r.check.startsWith("VERIFY") ? ' class="flag"' : ""}><td>${esc(r.thread)}</td><td>${esc(r.tap)}</td><td>${fix(r.dec, 4)}</td><td>${fix(mm(r.dec), 2)}</td><td>${esc(r.pct ? r.pct + "%" : "")}</td><td>${r.check.startsWith("VERIFY") ? "⚠" : r.check ? "ref" : ""}</td></tr>`
  ).join("");
  return `<h3>${esc(series)}</h3><table><thead><tr><th>Thread</th><th>Tap drill</th><th>Dec in</th><th>mm</th><th>~%</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}).join("");
const drillRows = drills.map(d => `<tr><td>${esc(d.name)}</td><td>${fix(d.dec, 4)}</td><td>${fix(mm(d.dec), 2)}</td></tr>`).join("");
// Two tables (4 + 5 operations) so each fits an 8-inch printed page without shrinking or clipping.
const sfmTable = [ops.slice(0, 4), ops.slice(4)].map(group =>
  `<table class="wide nobreak"><thead><tr><th>Material</th><th>ISO</th>${group.map(o => `<th>${o[1]}</th>`).join("")}</tr></thead><tbody>${
    data.materials.map(m => `<tr><td>${esc(m.name)}</td><td>${m.isoGroup}</td>${group.map(([k]) => `<td>${m.sfm[k].join(" / ")}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`
).join('<div style="height:8px"></div>');

const generated = new Date().toISOString().slice(0, 10);
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Sine — Shop Reference Sheet</title>
<style>
  @page { margin: 0.5in; }
  body { font: 10.5px/1.35 Arial, Helvetica, sans-serif; color: #111; margin: 0 auto; max-width: 8in; padding: 12px; }
  h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 13px; margin: 16px 0 4px; border-bottom: 2px solid #0070d8; padding-bottom: 2px; }
  h3 { font-size: 11px; margin: 8px 0 2px; }
  .meta { color: #444; margin-bottom: 8px; }
  .warn { border: 1px solid #b45309; background: #fff7ed; padding: 6px 8px; margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #bbb; padding: 1px 4px; text-align: left; }
  th { background: #eef2f7; } tr.flag td { background: #fee2e2; font-weight: bold; }
  .cols { column-count: 2; column-gap: 14px; } .cols h3 { break-after: avoid; } .cols table { break-inside: avoid; margin-bottom: 6px; }
  .drills { column-count: 4; column-gap: 8px; font-size: 9px; } .drills table { margin: 0; }
  table.wide { font-size: 9px; } table.wide td, table.wide th { padding: 1px 4px; }
  .formulas td:first-child { width: 28%; font-weight: bold; }
  @media print { h2 { break-after: avoid; } .nobreak { break-inside: avoid; } }
</style></head><body>
<h1>Sine — Shop Reference Sheet</h1>
<div class="meta">Generated ${generated} from js/data.js (data revision ${esc(data.provenance.revision)}). Inch values unless stated.</div>
<div class="warn"><b>Planning aid, not a replacement for tool-maker data.</b> Cutting speeds below are <b>${esc(data.provenance.baseline.label)}</b> — conservative starting assumptions, not manufacturer recommendations. Verify against the exact tool/insert data, machine, holder, workholding, coolant and prove-out before cutting. In the tap-drill tables, a red ⚠ row lists a drill outside the 65%–80% thread range this calculator computes — check a tap chart first; “ref” marks a large NPT value that is a reference figure, not a published tap-maker size — verify with the tap manufacturer. “~%” is the approximate thread percentage of the listed drill.</div>

<h2>Formulas</h2>
<table class="formulas"><tbody>${formulas.map(f => `<tr><td>${f[0]}</td><td>${f[1]}</td></tr>`).join("")}</tbody></table>

<h2>Tap drill sizes</h2>
<div class="cols">${tapSection}</div>

<h2>SFM baselines — low / standard / upper</h2>
${sfmTable}

<h2>Drill sizes by decimal (fractional, number, letter, metric)</h2>
<div class="drills"><table><thead><tr><th>Size</th><th>Dec in</th><th>mm</th></tr></thead><tbody>${drillRows}</tbody></table></div>
</body></html>`;
fs.writeFileSync(path.join(outDir, "Sine-Reference-Sheet.html"), html);

const flagged = tapRows.filter(r => r.check.startsWith("VERIFY"));
console.log(`Wrote ${outDir}: Sine-Reference-Sheet.html, tap-drills.csv (${tapRows.length} rows), drill-sizes.csv (${drills.length} rows), material-sfm-baselines.csv (${sfmRows.length - 1} rows)`);
if (flagged.length) console.log("Flagged tap-drill rows: " + flagged.map(r => r.series + " " + r.thread).join("; "));
