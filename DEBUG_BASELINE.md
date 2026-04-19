# Debug Style Baseline
A hidden debug UI tool is available in the web interface exclusively for executing the style baseline generation.

## How to Access

1. Open the preview of the application.
2. In the browser, ensure the application is active and focused.
3. Press **`Ctrl+Shift+D`** (or **`Cmd+Shift+D`** on Mac).
4. A floating panel titled "Style Baseline Runner (DEV ONLY)" will appear in the bottom-right corner.

## Usage

1. Select "Force regenerate (overwrite existing)" if you want to rerun generation for topics that were completed previously. Wait until the total manifest size updates.
2. Click **Run Baseline**. The execution status for each topic will be streamed over an SSE connection in real-time, preventing HTTP timeouts. The tool uses the application's underlying Gemini infrastructure and locally injected API keys.
3. Wait for all checks to mark "Complete" or "Skipped" and for the Total Cost tally.
4. Once completed, a "Download run-manifest.json" button will appear. 
5. Provide the resulting data files back from `tests/style-baseline/before/` as verification in the chat!
