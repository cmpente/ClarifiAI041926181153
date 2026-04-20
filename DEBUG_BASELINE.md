# Running the Style Baseline (AI Studio Compatible)

1. Open the app in AI Studio.
2. Ensure your Gemini API key is saved via the Settings gear icon.
3. Press **Ctrl+Alt+B** to open the Debug Baseline panel.
4. Paste your API key into the panel's key input (if not auto-populated from localStorage).
5. Click **Run Baseline**.
6. Wait for all 5 topics to show ✅. Runtime: ~5–15 minutes. Cost: ~$0.15.
7. Click **"Download Manifest + All (ZIP)"**.
8. Extract the ZIP at your repo root. The files will land in `tests/style-baseline/before/`.
9. The "Compare" tab can be used for deep visual diffing against golden references.
10. Commit the new files.
11. Return to the AI Studio chat and tell the senior dev AI the files are in place.

## Manual Image Curation Instructions
For Phase 2, please manually ensure the 5 `facility-anchor` files in `src/data/Reference Images/facility-anchor/` are accurately cropped from `reference_images_under30mb.pdf`, specifically obtaining:
- `facility-wide-shot.png` (ceiling sheeting + conveyors)
- `facility-floor-tanks.png` (red wet floor + tanks)
- `product-raw-patties.png` (pink patties)
- `product-cooked-patties.png` (brown cooked patties)
- `ceiling-utility-runs.png` (ceiling detail)

## New Dev Endpoints Added:
- `/api/debug/vision-qa/:slug`: Triggers automated visual validation using gemini-2.5-flash.
- `/api/debug/prompt-self-test`: Statically verifies logic generation and block injection.
