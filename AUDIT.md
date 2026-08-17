# GR Programming Calculator Audit

Audit target: `main` at `1f6429d`

## Reliability branch progress

The first implementation pass on `audit/calculator-reliability-v1` now includes:

- A browser/Node-compatible pure calculation core
- Automated calculation, data-validation, and page-contract tests
- Explicit SFM/RPM calculation basis for milling, turning, and tapping
- Thread-mill flute count and internal/external centerline geometry
- Explicit source selection for circle and right-triangle solvers
- Validation for countersink and helix geometry
- Fractional drill sizes through 2 inches
- Escaping for user-entered drill text
- Removal of obsolete calculation functions and repeated initialization
- A more compact mobile header and accessible live result regions

The data-credibility pass now adds:

- Operation- and tool-class-specific low/standard/upper SFM baselines
- ISO workpiece groups and visible baseline provenance
- Separate shop materials for 65-45-12 ductile iron, gray iron, ADI, CD4MCuN, and SG70A-T6
- Expanded UNC, UNF, metric, and NPT selections, including 3-inch and 4-inch NPT work
- Exact/reference confidence labels for NPT tap-drill data
- Removal of the unsupported NPT form-tap approximation
- A dedicated versioned data module and data-validation tests
- Removal of unrelated EXE, STEP, and DXF files from the calculator repository
- A documented data-source and update policy

The modularization pass now adds:

- Dedicated HTML, CSS, controller, calculation, and reference-data files
- An explicit `data.js` -> `core.js` -> `app.js` browser load order
- Page-contract tests that reject embedded controller/style regressions
- Cross-file checks for inline handlers and direct DOM references

The shop-workflow pass now adds:

- Browser-local user-defined machine profiles with optional RPM and feed-IPM limits
- Visible advisory limit checks for milling, drilling, turning, tapping, and thread milling
- Persisted material, tool, operation, unit, and baseline selections
- Copyable and downloadable shop-result notes with machine and timestamp context
- An installable web-app manifest, 192/512 icons, and an offline service-worker cache
- A dedicated, tested workflow module that keeps profile validation out of the DOM controller

The feature-expansion pass now adds:

- Internal and external circular-interpolation feed compensation at cutter centerline
- Effective cutting diameter and SFM for ball-nose and tapered tools
- Two-way ball-tool scallop-height and stepover solving
- Diametrical true-position calculation from nominal and actual centers
- Bore stock, equal rough-pass, prefinish-diameter, and finish-allowance planning
- Pure functions, invalid-domain handling, regression tests, and formula-table entries for each addition
- No controller-specific code generator, preserving the calculator as a simple verified math webpage

## Executive summary

The staged audit is complete. The calculator now separates markup, styles, reference data, formulas, workflow logic, and DOM behavior; rejects invalid geometry; identifies reference-data assumptions; preserves explicit input authority; supports browser-local machine limits and result export; works offline; and covers advanced milling and inspection math with regression tests. It remains a simple static webpage and intentionally does not generate controller-ready CNC code.

The recommended order is:

1. Fix result-integrity defects.
2. Add regression tests for every machining formula.
3. Separate pure calculation logic from page behavior and reference data.
4. Improve shop/mobile workflow.
5. Expand the verified reference data and feature set.

## Critical findings

### C-01: RPM and SFM fields become conflicting sources of truth

Affected calculators:

- Milling and drilling
- Turning
- Tapping

After a calculation fills the missing RPM or SFM field, both fields remain populated. A later change to tool diameter, material, thread, RPM, or SFM can leave the old value in place. Milling and turning show two conflicting calculations but continue calculating feed from the entered/stale RPM. The tap calculator does not even warn about the mismatch.

Required fix: make the operator choose a calculation basis (`SFM -> RPM` or `RPM -> SFM`), or track which field was most recently edited and clear/recalculate the dependent field.

### C-02: Thread-mill feed omits flute count

`calcThreadMill()` labels the input as FPT but calculates feed as `RPM × FPT`. Correct feed from chip load requires `RPM × number of cutting teeth × FPT`. There is no flute-count input.

Example with the current defaults:

- Current result: `1800 × 0.0015 = 2.7 IPM`
- A three-flute cutter would require: `1800 × 3 × 0.0015 = 8.1 IPM`

Required fix: add cutting teeth/flutes and use it in feed calculation.

### C-03: The drill database is truncated below sizes required by the thread data

The generated fractional list stops below 1 inch, and `allDrills` filters out anything larger than approximately 1 inch. The 1-inch NPT row specifies a 1-5/32-inch tap drill, but the selection logic cannot represent it and will choose a smaller drill near the top of the truncated chart.

Required fix: expand fractional, letter, number, metric, and large-size drill data to the calculator's supported thread range. Preserve canonical drill names rather than deriving all names through nearest-size matching.

### C-04: Multi-input solvers silently prioritize stale/default values

Affected calculators:

- Circle calculator always prioritizes diameter, so editing radius or circumference is ignored while diameter remains populated.
- Right-triangle solver prioritizes sides A and B. Its initialization fills all fields, so later edits to an angle or hypotenuse can be ignored.

Required fix: provide an explicit solve-from selector or reliably track the last edited fields. Never infer intent from whichever prefilled field is first in the function.

### C-05: Preset cutting speeds are not modeled by operation and tool material

Each material has one SFM value reused across HSS drilling, carbide drilling, end milling, face milling, shoulder milling, and turning. Tool material changes drill feed but not drill surface speed. The UI presents these numbers as starting presets even though these operations require different speed ranges.

Required fix: replace the single material SFM with sourced ranges keyed by operation and cutting-tool material. Show the source, revision/date, and whether the value is a conservative shop default or manufacturer recommendation.

## High-priority findings

### H-01: NPT output is presented with more confidence than the data supports

NPT tap-drill ranges are created by walking to neighboring entries in a mixed drill list. NPT form-tap recommendations are approximated even though support depends heavily on the tap manufacturer and application. The helper also does not cover the larger NPT sizes used in the shop.

Required fix: use a dedicated, sourced NPT table; mark unsupported combinations unavailable instead of estimating them; expand sizes required by actual work.

### H-02: Thread milling only models one internal-thread geometry

The centerline path uses `major diameter - tool diameter`, which is an internal-thread assumption. There is no internal/external selector, no handedness, no climb/conventional direction, and no tooth count. NPT path-diameter direction also depends on toolpath direction and start end.

Required fix: make thread type and cutting direction explicit and label whether output is geometry guidance or controller-ready motion data.

### H-03: Invalid geometry can produce plausible-looking negative or zero results

Examples:

- Countersink major diameter smaller than starting hole returns negative depth.
- Helix tool diameter larger than the bore returns a negative cutting radius and pitch.
- `round()` converts non-finite results to the string `0`, hiding calculation failures.
- Many number fields accept negative values and impossible angles.

Required fix: centralize validation and return a clear error state instead of formatting invalid math as zero.

### H-04: Generic peck guidance lacks the inputs needed for a dependable recommendation

The peck helper uses only depth/diameter ratio and four broad material groups. It does not account for carbide vs. HSS, through-coolant, drill geometry, chip form, coolant pressure, or manufacturer cycle guidance.

Required fix: either expand inputs and source the recommendations or reframe this as a depth-ratio classifier with conservative cautions rather than a specific peck recommendation.

### H-05: User-controlled text is inserted with `innerHTML`

Parsed drill input and candidate drill text can be placed into HTML output. A crafted value can introduce markup into the page.

Required fix: construct output with text nodes or escape all user-provided values. Reserve `innerHTML` for static trusted templates.

## Maintainability and repository findings

### M-01: The application is a monolithic file

`index.html` contains:

- 260+ lines of HTML/CSS before the interface
- reference tables and preset data
- all calculation logic
- all DOM behavior
- repeated initialization logic

Required fix: separate `index.html`, `styles.css`, calculation modules, UI/controller code, and reference data. Keep calculations pure so they can be tested without a browser.

Status: resolved in the modularization pass. The interface, stylesheet, browser controller, pure calculations, and reference data are now separate files with contract coverage.

### M-02: There are no automated tests or CI checks

There is no test suite for formula boundaries, unit conversions, stale-state behavior, drill lookups, or invalid inputs.

Required fix: add data-driven tests with known inputs and expected outputs, then run them in GitHub Actions.

### M-03: Dead code references controls that do not exist

Unused functions reference missing elements including:

- `face45Result`
- `shoulder90Result`
- `helixRampResult`

There is also an older unused turning function. These are remnants of earlier UI versions and make future debugging harder.

Required fix: remove dead functions after confirming that no feature is meant to be restored.

### M-04: Initialization is repeated and mutates user-visible fields

Selectors are populated during script execution, again on `load`, and again after a 50 ms timeout. This is a workaround rather than deterministic initialization and can reset selections.

Required fix: initialize exactly once after the DOM is ready.

### M-05: Unrelated binary and CAD files are stored at the web root

The repository includes:

- `MC2026CopilotAddIn.exe`
- `520018712.stp`
- `520018712.dxf`

These do not appear to be calculator assets. They increase repository size, reduce trust in a public calculator repository, and mix unrelated work with the deployed site.

Required fix: move them to their correct project or release storage. Remove them from this repository in a dedicated cleanup commit after confirming they are not intentionally distributed here.

### M-06: Project documentation is missing

There is no README explaining purpose, deployment, supported formulas, data sources, limitations, test commands, or contribution workflow.

Required fix: add concise project documentation and a calculation/data provenance document.

## Usability findings

- The sticky mobile header can consume a large part of the viewport because the 44 px title and wrapped navigation do not have a mobile-specific layout.
- Result areas do not announce changes to screen readers.
- Unit selection is inconsistent; several calculators are inch-only without an explicit unit label beside every result.
- The external Google Font prevents fully offline use.
- Frequently used values cannot be saved as shop/machine/tool presets.
- Results cannot be copied as a compact setup note or CNC-oriented block.
- There is no installable/offline PWA behavior, which would be valuable on the shop floor.

## Recommended implementation passes

### Pass 1: Reliability baseline

- Add pure calculation modules and regression tests.
- Fix RPM/SFM authority and stale-value behavior.
- Fix thread-mill flute count and internal/external assumptions.
- Fix circle and triangle input selection.
- Add centralized validation and safe output rendering.
- Expand the drill list beyond 1 inch.

### Pass 2: Data credibility

- Replace generic SFM presets with operation/tool-specific sourced ranges.
- Build dedicated UNC, UNF, metric, and NPT reference datasets.
- Add data provenance and revision metadata.
- Validate known shop cases against hand calculations and tooling references.

### Pass 3: Shop workflow

Status: completed on `audit/calculator-reliability-v1`.

- Mobile-first navigation and compact result cards.
- Material/tool preferences and machine profiles stored locally.
- Copy/export results.
- Machine RPM/feed caps and warning states.
- Installable offline app.

### Pass 4: Feature expansion

Status: completed on `audit/calculator-reliability-v1`.

Delivered:

- Circular interpolation feed compensation at cutter centerline
- Effective diameter / surface speed for tapered and ball-nose tools
- Scallop height and stepover
- True-position inspection helper
- Bore interpolation and stock-removal planning

Internal/external thread-mill path and feed calculations were completed in Pass 1. Machine-specific G-code templates were intentionally excluded to keep controller output separate from the verified math layer.

## Acceptance standard

No calculated result should be considered production-ready until:

1. Its formula is isolated from the UI.
2. Units are explicit at the function boundary.
3. Invalid domains return an error rather than zero.
4. Known-value and boundary tests pass.
5. Preset/reference data has an identified source or is clearly labeled as a shop-defined assumption.
6. The displayed output states the calculation basis and units.
