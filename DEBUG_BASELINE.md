# Running the Style Baseline (AI Studio Compatible)

1. Open the app in AI Studio.
2. Ensure your Gemini API key is saved via the Settings gear icon.
3. Press **Ctrl+Alt+B** to open the Debug Baseline panel.
4. Paste your API key into the panel's key input (if not auto-populated from localStorage).
5. Click **Run Baseline**.
6. Wait for all 5 topics to show ✅. Runtime: ~5–15 minutes. Cost: ~$0.15.
7. Click **"Download Manifest + All (ZIP)"**.
8. Extract the ZIP at your repo root. The files will land in `tests/style-baseline/before/`.
9. Commit the new files.
10. Return to the AI Studio chat and tell the senior dev AI the files are in place.
