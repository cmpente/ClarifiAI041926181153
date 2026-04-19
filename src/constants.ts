import { Type } from "@google/genai";
import { z } from "zod";

export const SafetyPosterSchema = z.object({
  header_en: z.string(),
  header_fr_ht: z.string(),
  header_es_bs: z.string(),
  wall_type: z.string(),
  product_type: z.string(),
  equipment_focus: z.string(),
  primary_worker: z.string(),
  left_action: z.string(),
  left_violation: z.string(),
  left_risk: z.string(),
  center_intervention_action: z.string(),
  center_correction: z.string(),
  right_action: z.string(),
  poster_prompt: z.string()
});

export type SafetyPosterData = z.infer<typeof SafetyPosterSchema>;

export const GEMINI_TEXT_MODEL = "gemini-3.1-pro-preview";
export const GEMINI_IMAGE_MODEL_PRO = "gemini-3-pro-image-preview";
export const GEMINI_IMAGE_MODEL_FLASH = "gemini-2.5-flash-image";
export const GEMINI_IMAGE_MODEL_FLASH_3_1 = "gemini-3.1-flash-image-preview";
export const GEMINI_EDIT_MODEL = "gemini-2.5-flash-image";

export interface VisionQAResult {
  isValid: boolean;
  issues: string[];
  critique: string;
}

export const MASTER_IMAGE_PROMPT_TEMPLATE = `Create a professional 3-panel industrial safety training poster.

HEADER TEXT (STRICT — MUST APPEAR IN IMAGE):

Line 1:
{{HEADER_EN}}

Line 2:
{{HEADER_FR_HT}}

Line 3:
{{HEADER_ES_BS}}

RULES:
- Centered in white header area
- Bold industrial sans-serif font style
- ALL CAPS
- No additional text anywhere else in the image

LAYOUT (STRICT):
- Horizontal layout
- Exactly 3 equal-width panels
- Rounded rectangular panels with thin black outlines
- Even spacing between panels
- Clean white header area above panels
- No layout variation

STYLE (STRICT):
- Flat industrial safety poster illustration
- Clean linework with soft subtle shading
- Muted industrial color palette
- Semi-realistic human proportions
- No photorealism
- No 3D rendering
- No anime or cartoon exaggeration
- Corporate safety training aesthetic

ENVIRONMENT (FIXED DNA):
- Floor: brownish-red epoxy with subtle white antimicrobial dusting
- Walls: {{WALL_TYPE}}
- Background: exposed piping, conduit, industrial fixtures
- Lighting: bright cool industrial lighting
- Equipment: stainless steel machinery with {{EQUIPMENT_FOCUS}}

PPE (STRICT ENFORCEMENT):
- Worker:
  - white hard hat
  - white frock
  - clear safety glasses
  - black rubber boots
  - white mesh hairnet balaclava
- Supervisor:
  - green hard hat
  - white frock
  - clear safety glasses
  - black rubber boots
  - white mesh hairnet balaclava

PRODUCT RULES:
- Show only: {{PRODUCT_TYPE}}

STRUCTURE:

LEFT PANEL:
Worker ({{PRIMARY_WORKER}}) is {{LEFT_ACTION}}.
Violation: {{LEFT_VIOLATION}}.
Risk: {{LEFT_RISK}}.

CENTER PANEL:
Supervisor is {{CENTER_INTERVENTION_ACTION}}.
Correction: {{CENTER_CORRECTION}}.

RIGHT PANEL:
Worker ({{PRIMARY_WORKER}}) is {{RIGHT_ACTION}}.
Safe behavior compliant.

CRITICAL RULES:
- NO TEXT except header block
- No labels, symbols, or captions
- All panels must show identical environment and characters
- LEFT must show unsafe action
- CENTER must show correction intervention
- RIGHT must show corrected safe behavior`;
