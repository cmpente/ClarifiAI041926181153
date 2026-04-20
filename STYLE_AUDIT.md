# Style Audit — Phase 1 Baseline

## Manifest Summary
| Topic | File | Size (bytes) | SHA-256 (first 8) | Cost | Elapsed (s) |
|-------|------|--------------|-------------------|------|-------------|
| LOTO - Jammed Conveyor | `before/loto-jammed-conveyor.png` | 1108672 | 9d82ab4e | $0.0456 | 72.3 |
| GMPs - Wash Hands | `before/gmps-wash-hands.png` | 1082564 | aa7f96c9 | $0.0452 | 89.4 |
| Slips, Trips, and Falls - Wet Floors | `before/slips-trips-and-falls-wet-floors.png` | 1099306 | 97d10ef2 | $0.0456 | 70.7 |
| Mobile Equipment - Stand-Up Forklift Path | `before/mobile-equipment-stand-up-forklift-path.png` | 1152922 | 781b5001 | $0.0462 | 64.6 |
| Food Safety - Grade Out Nonconforming Product | `before/food-safety-grade-out-nonconforming-product.png` | 1147715 | 24a58635 | $0.0458 | 74.7 |

## Baseline Metrics (Phase 4 Must Beat These)

- **Total prompt character count (sum across 5 topics):** 43,168
- **Per-topic prompt length (avg):** 8,633
- **Emphasis word count per prompt:** 
  - STRICT: 7
  - MANDATORY: 1
  - CRITICAL: 5
  - MUST: 25
  - ABSOLUTELY: 3
- **Total API cost:** $0.228
- **Avg generation time per topic:** 74.3s

## Per-Topic Observations

## Defect Catalog
### GMP Compliance — Wash Hands (6 defects)
1. R panel: Worker washing hands while wearing blue nitrile gloves. [Semantic / High]
2. R panel: Supervisor behind worker has no visible gloves. [PPE / Medium]
3. All panels: Sink configuration changes (double-basin → single-bowl → wall-mounted). [Continuity / High]
4. All panels: Soap dispenser placement shifts walls between panels. [Continuity / Medium]
5. All panels: No safety glasses on any character in any panel. [PPE / High]
6. Floor color transitions from reddish-brown (L) to neutral gray (C, R). [Continuity / Critical — facility is red epoxy]

### Food Safety — Grade Out Defective Product (7 defects)
7. L panel: Worker has bare hands at sides near exposed product. [PPE / Critical]
8. C panel: Supervisor holds product with bare hands. [PPE / Critical]
9. C panel: Second worker has no visible balaclava. [PPE / High]
10. All panels: No safety glasses on any worker. [PPE / High]
11. All panels: Product rendered as BREAD LOAVES instead of sausage patties. [Product identity / Critical]
12. L → R: Conveyor layout changes shape and length. [Continuity / High]
13. C, R: Grey discard bin appears and repositions inconsistently. [Continuity / Medium]

### Stand-Up Forklift Safety — Stay In Designated Paths (8 defects)
14. All panels: Yellow pedestrian lane markings have completely different layouts. [Continuity / Critical — also facility is wrong, real plant has minimal floor striping]
15. L panel: Vehicle is a pedestrian walkie/pallet jack, NOT a stand-up forklift. [Product type / Critical]
16. L panel: Forklift operator has no safety glasses and no balaclava under hard hat. [PPE / High]
17. C panel: 2 of 3 foreground figures have no hard hats (balaclava only). [PPE / Critical]
18. C panel: Stray yellow forklift fork/arm appears floating. [Mechanical illogic / Medium]
19. R panel: Forklift driver has no hard hat (balaclava only). [PPE / High]
20. R panel: Narrative required a pedestrian walking in the lane; no pedestrian shown. [Narrative / High]
21. All panels: Warehouse racking identical but floor markings completely different. [Continuity / Medium]

### LOTO — Jammed Conveyor (9 defects)
22. L panel: Two workers drawn with fused/overlapping anatomy. [Anatomy / Critical]
23. L panel: Product is RAW WHOLE CHICKENS / PORK CUTS piled chaotically. [Product identity / Critical — should be sausage patties on blue modular belt]
24. C panel: Stray "OFF" text label on switch box. [Stray text / Medium]
25. C panel: Foreground worker has safety glasses but no hard hat. [PPE / High]
26. C panel: Worker holds raw product in gloved hand during LOTO action. [Narrative / High]
27. R panel: Red safety padlock rendered as rectangular tag only, no lock body. [Product type / Medium]
28. R panel: Worker applying lock has no hard hat; supervisor's balaclava not visible. [PPE / High]
29. R panel: Switch lever orientation unchanged from C — not clearly in OFF position. [Narrative / Medium]
30. L → R: Background architecture changes between all three panels. [Continuity / High]

### Facility Fidelity (6 defects affecting all posters)
31. All posters: Ceiling rendered as generic white/light surface instead of exposed raw concrete beams with dense overhead utility runs. [Facility / High]
32. All posters: Missing iconic clear plastic washdown sheeting draped from ceiling over equipment. [Facility / High]
33. All posters: Conveyor belt surfaces rendered as generic gray/stainless instead of signature blue modular plastic belts. [Facility / Medium]
34. All posters: Orange 55-gallon rolling waste bins missing from backgrounds — signature facility element. [Facility / Medium]
35. LOTO: Mettler Toledo metal detector specified in prompt but never rendered despite being prominent facility feature. [Facility / Medium]
36. All posters: No distinctly Waterloo/Tyson facility markers — generic "food plant" aesthetic. [Facility / High]

### LOTO - Jammed Conveyor
- **File:** `before/loto-jammed-conveyor.png` (1108672 bytes)
- **Narrative rendered correctly:** ⚠️ UNVERIFIED — requires operator to fill in
- **Linework:** ⚠️ UNVERIFIED — requires operator to fill in
- **Color palette:** ⚠️ UNVERIFIED — requires operator to fill in
- **Character PPE compliance:** ⚠️ UNVERIFIED — requires operator to fill in
  - Hard hats correct color? 
  - Balaclavas semi-transparent mesh?
  - Blue nitrile gloves present?
  - Black rubber boots present?
  - Yellow aprons present (should be NO)?
- **Environment grounding:** ⚠️ UNVERIFIED — requires operator to fill in
- **Panel layout:** ⚠️ UNVERIFIED — requires operator to fill in
- **Status icons (red X / green ✓):** ⚠️ UNVERIFIED — requires operator to fill in
- **Header text legibility:** ⚠️ UNVERIFIED — requires operator to fill in
- **Deltas from golden set:** ⚠️ UNVERIFIED — requires operator to fill in

### GMPs - Wash Hands
- **File:** `before/gmps-wash-hands.png` (1082564 bytes)
- **Narrative rendered correctly:** ⚠️ UNVERIFIED — requires operator to fill in
- **Linework:** ⚠️ UNVERIFIED — requires operator to fill in
- **Color palette:** ⚠️ UNVERIFIED — requires operator to fill in
- **Character PPE compliance:** ⚠️ UNVERIFIED — requires operator to fill in
  - Hard hats correct color? 
  - Balaclavas semi-transparent mesh?
  - Blue nitrile gloves present?
  - Black rubber boots present?
  - Yellow aprons present (should be NO)?
- **Environment grounding:** ⚠️ UNVERIFIED — requires operator to fill in
- **Panel layout:** ⚠️ UNVERIFIED — requires operator to fill in
- **Status icons (red X / green ✓):** ⚠️ UNVERIFIED — requires operator to fill in
- **Header text legibility:** ⚠️ UNVERIFIED — requires operator to fill in
- **Deltas from golden set:** ⚠️ UNVERIFIED — requires operator to fill in

### Slips, Trips, and Falls - Wet Floors
- **File:** `before/slips-trips-and-falls-wet-floors.png` (1099306 bytes)
- **Narrative rendered correctly:** ⚠️ UNVERIFIED — requires operator to fill in
- **Linework:** ⚠️ UNVERIFIED — requires operator to fill in
- **Color palette:** ⚠️ UNVERIFIED — requires operator to fill in
- **Character PPE compliance:** ⚠️ UNVERIFIED — requires operator to fill in
  - Hard hats correct color? 
  - Balaclavas semi-transparent mesh?
  - Blue nitrile gloves present?
  - Black rubber boots present?
  - Yellow aprons present (should be NO)?
- **Environment grounding:** ⚠️ UNVERIFIED — requires operator to fill in
- **Panel layout:** ⚠️ UNVERIFIED — requires operator to fill in
- **Status icons (red X / green ✓):** ⚠️ UNVERIFIED — requires operator to fill in
- **Header text legibility:** ⚠️ UNVERIFIED — requires operator to fill in
- **Deltas from golden set:** ⚠️ UNVERIFIED — requires operator to fill in

### Mobile Equipment - Stand-Up Forklift Path
- **File:** `before/mobile-equipment-stand-up-forklift-path.png` (1152922 bytes)
- **Narrative rendered correctly:** ⚠️ UNVERIFIED — requires operator to fill in
- **Linework:** ⚠️ UNVERIFIED — requires operator to fill in
- **Color palette:** ⚠️ UNVERIFIED — requires operator to fill in
- **Character PPE compliance:** ⚠️ UNVERIFIED — requires operator to fill in
  - Hard hats correct color? 
  - Balaclavas semi-transparent mesh?
  - Blue nitrile gloves present?
  - Black rubber boots present?
  - Yellow aprons present (should be NO)?
- **Environment grounding:** ⚠️ UNVERIFIED — requires operator to fill in
- **Panel layout:** ⚠️ UNVERIFIED — requires operator to fill in
- **Status icons (red X / green ✓):** ⚠️ UNVERIFIED — requires operator to fill in
- **Header text legibility:** ⚠️ UNVERIFIED — requires operator to fill in
- **Deltas from golden set:** ⚠️ UNVERIFIED — requires operator to fill in

### Food Safety - Grade Out Nonconforming Product
- **File:** `before/food-safety-grade-out-nonconforming-product.png` (1147715 bytes)
- **Narrative rendered correctly:** ⚠️ UNVERIFIED — requires operator to fill in
- **Linework:** ⚠️ UNVERIFIED — requires operator to fill in
- **Color palette:** ⚠️ UNVERIFIED — requires operator to fill in
- **Character PPE compliance:** ⚠️ UNVERIFIED — requires operator to fill in
  - Hard hats correct color? 
  - Balaclavas semi-transparent mesh?
  - Blue nitrile gloves present?
  - Black rubber boots present?
  - Yellow aprons present (should be NO)?
- **Environment grounding:** ⚠️ UNVERIFIED — requires operator to fill in
- **Panel layout:** ⚠️ UNVERIFIED — requires operator to fill in
- **Status icons (red X / green ✓):** ⚠️ UNVERIFIED — requires operator to fill in
- **Header text legibility:** ⚠️ UNVERIFIED — requires operator to fill in
- **Deltas from golden set:** ⚠️ UNVERIFIED — requires operator to fill in

## Comparison to Golden Set

Reference images in `tests/style-baseline/golden/`:
- `10.0 Food Safety - Remove Old Labels.png`
- `2.2 PIT Safety - Look Back.png`
- `4.2 PPE Safety - Proper Footwear.png`
- `6.0 GMPs - Fake Lashes.png`
- `9.0 Team Reminders - Check Schedule.png`

### Style Dimensions Where Baseline Drifts from Golden

1. **Balaclava rendering:** Baseline ⚠️ UNVERIFIED — requires operator to fill in (Known issue: opaque white caps vs semi-transparent mesh). Golden renders as semi-transparent mesh.
2. **Color palette:** Baseline ⚠️ UNVERIFIED — requires operator to fill in (Known issue: oversaturated). Golden relies on muted vintage tones.
3. **Linework:** Baseline ⚠️ UNVERIFIED — requires operator to fill in (Known issue: digital-sharp). Golden uses organic comic-style ink.
4. **Environment density:** Baseline ⚠️ UNVERIFIED — requires operator to fill in (Known issue: less rich). Golden offers rich dense backgrounds.
5. **PPE consistency across panels:** Baseline ⚠️ UNVERIFIED — requires operator to fill in (Known issue: gloves inconsistent). Golden characters are perfectly consistent.

### Style Dimensions Where Baseline Matches Golden

1. ⚠️ UNVERIFIED — requires operator to fill in
2. ⚠️ UNVERIFIED — requires operator to fill in

## Root Cause Hypotheses (For Phase 2+ to Address)

1. Style rules duplicated between `systemInstruction` template and `masterStyleWrapper` — rules stated 2–3 times in slightly different wording dilute the signal.
2. Reference image folder is uncurated — 7 images loaded indiscriminately, some off-style.
3. Reference images lack explicit "this is style anchor" framing — model treats them as ambiguous context.
4. Environment specification (~40 lines) appears after art-style description and dominates attention.
5. Emphasis words ("STRICT", "MANDATORY", "CRITICAL") appear 15+ times per prompt — when everything is emphasized, nothing is.

## Phase 2 Readiness

- [ ] Golden set confirmed in `tests/style-baseline/golden/`
- [ ] 5 baseline PNGs + 5 prompt.txt files in `tests/style-baseline/before/`
- [ ] `run-manifest.json` present and validated
- [ ] `STYLE_AUDIT.md` complete
- [ ] Baseline metrics computed and recorded
