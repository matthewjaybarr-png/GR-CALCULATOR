# GR Programming Calculator

A lightweight browser-based collection of machining, CNC programming, geometry, thread, drill, and shop-math helpers.

## Shop workflow

- Save multiple user-defined machine profiles with spindle-RPM and feed-IPM limits.
- Show advisory limit checks on milling, drilling, turning, tapping, and thread-milling results without changing the calculated values.
- Remember common material, tool, operation, unit, and baseline selections in the current browser.
- Copy the latest calculation as a labeled setup note or download it as a text file.
- Install the calculator as an offline-capable app after it has been loaded once over HTTPS or localhost.

Machine profiles and preferences are stored only in the current browser. Clearing site data removes them.

## Advanced math

- Internal/external circular-interpolation centerline feed compensation
- Ball-nose and tapered-tool effective cutting diameter and effective SFM
- Ball-tool scallop height or stepover solving
- Diametrical true position from nominal and actual centers
- Bore stock, equal rough-pass, prefinish-diameter, and finish-allowance planning

The calculator intentionally does not generate controller-ready CNC code. Programming output remains separate from the verified math layer.

## Current status

The staged reliability audit is complete. Calculation integrity, reference-data provenance, modularization, shop workflow, offline use, and the final advanced-math expansion are covered by automated tests. See [AUDIT.md](AUDIT.md) for the findings and completed implementation record.

The calculator is a programming aid, not a replacement for tooling manufacturer data, machine limits, workholding review, or inspection. Generic speed/feed estimates must be verified for the exact cutter, insert, material condition, holder, stickout, coolant, machine, and operation before use.

## Run locally

The site has no production dependencies. Serve the repository with any static web server, then open the displayed local URL.

```bash
python -m http.server 8000
```

## Test

Node.js is required for the calculation regression tests. No package installation is needed.

```bash
node --test tests/*.test.js
```

or:

```bash
npm test
```

## Project structure

- `index.html` — semantic interface markup and asset loading order
- `css/styles.css` — responsive interface and component styles
- `js/app.js` — browser controller, DOM behavior, and calculator orchestration
- `js/core.js` — pure, validated calculation functions shared by the page and tests
- `js/data.js` — versioned material baselines, thread data, and provenance metadata
- `js/workflow.js` — validated machine-profile and limit-checking logic
- `manifest.webmanifest` and `service-worker.js` — installable/offline application support
- `tests/core.test.js` — calculation regression tests
- `tests/data.test.js` — reference-data validation tests
- `tests/page-contract.test.js` — interface/controller integration contracts
- `tests/workflow.test.js` — machine-profile and machine-limit regression tests
- `AUDIT.md` — audit findings and staged improvement plan
- `SOURCES.md` — source, assumption, and update policy for machining data
