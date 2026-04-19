# How to Run the Style Baseline

## Prerequisites
- `.env.local` contains `GEMINI_API_KEY=<your-key>`
- Dev server running: `npm run dev`

## Dry run (no API calls, no cost)
```bash
npx tsx scripts/runStyleBaseline.ts --dry-run
```

## Full run
```bash
npx tsx scripts/runStyleBaseline.ts
```

Expected cost: ~$0.15 (5 topics × Pro text + Pro image).
Expected runtime: 5–15 minutes depending on queue.

## Outputs
- `tests/style-baseline/before/<slug>.png` — generated images
- `tests/style-baseline/before/<slug>.prompt.txt` — literal assembled prompt
- `tests/style-baseline/before/run-manifest.json` — per-topic costs, timings, file hashes
