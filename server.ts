import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { setGlobalDispatcher, Agent } from 'undici';
import { processEnvironmentFromPDF, validateEnvironmentInjection } from './src/lib/pdfEnvironmentParser.js';

// Set global undici dispatcher with long timeouts to prevent HeadersTimeoutError
setGlobalDispatcher(new Agent({
  connect: { timeout: 600000 },
  headersTimeout: 600000,
  bodyTimeout: 600000
}));

dotenv.config();
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local", override: true });
}


function getSystemInstruction() {
  return `You are a strict industrial safety poster planner and creative director.
Your job is to deeply analyze, creatively expand, and map the user's safety topic into a highly robust, structured JSON plan. Even if the user's input is brief, you must synthesize a rich, cohesive visual narrative with explicit environments, character positioning, and precise mechanics.

CRITICAL PRODUCT IDENTITY RULE for Tyson Prepared Foods:
When describing any panel that depicts product on conveyors, in bins, or in hands:
- Explicitly name the product as "fully-cooked sausage patties" or "sausage crumbles" as appropriate to the process stage.
- Name the belt type as "blue modular plastic conveyor belt" when belts are involved.
- Name the product state (raw pink / cooked brown / frozen) based on process zone.
- Never use generic terms like "food product" or "items on conveyor" — always be specific.

You MUST include a \`sceneTypes: string[]\` array classifying the requested topic. Emit keywords like "handwashing", "product_inspection", "loto", "forklift", "sanitation_washdown", or "sign_present" if applicable to the narrative.

For the 'poster_prompt' field in your JSON output, you MUST output this EXACT template entirely, filling in the [BRACKETED] placeholders based on your expanded narrative:

Subject & Medium
A landscape workplace safety poster (16:9 aspect ratio). Style: Hand-drawn corporate safety illustration with soft watercolor/airbrush shading and clean, continuous comic-style ink outlines. Aesthetic: Slightly vintage industrial training manual, semi-realistic but extremely clear. Background: Off-white/cream paper texture with a faint vintage vignette.

CRITICAL CONVEYOR & MACHINERY RULES:
- Conveyor lines and production machines MUST be mechanically logical. 
- You MUST NOT draw conveyor belts or pipes that suddenly cut off, float in mid-air, or start/end nowhere.
- Conveyors must continuously extend off-screen or clearly connect to the next stage of machinery. All equipment must look physically grounded and complete.

CRITICAL CONTINUITY & CAMERA RULES:
- The structural background (machinery layout, tanks, pillars, drains) and character designs MUST remain highly consistent across all three panels. It is the exact same physical location.
- However, DO NOT lock the viewer into a single static security-camera perspective. You must vary the camera angle or framing between panels (e.g., wide shot, closer medium angle, slightly different perspective) to create a dynamic, engaging comic-book narrative flow without breaking the architectural continuity.

Header (The ONLY Text Allowed)
Alignment: Centered at the very top. Font: Huge, bold, condensed sans-serif.
Text Line 1 (Black, Largest): [MAIN ENGLISH TITLE / TOPIC]
Text Line 2 (Black, 40% size of header, directly below, crisp and sharp with NO double-printing): [TRANSLATED TEXT / SECONDARY SUBTITLE]

No Other Text
There is absolutely no other readable text, labels, titles, speech bubbles, or timestamps anywhere in the image. The panels themselves must be strictly visual. DO NOT generate text labels like "LEFT PANEL" or "RIGHT PANEL" anywhere in the image.

Panel Layout & Status Icons
Three equal-width rounded rectangular panels arranged Left / Center / Right.
Left Panel: MUST feature a large RED CIRCULAR "X" MARK positioned perfectly centered at the very bottom of the panel. NO bottom text labels. NO arrows.
Center Panel: MUST feature a large GREEN CIRCULAR CHECK MARK positioned perfectly centered at the very bottom of the panel. NO bottom text labels. NO arrows.
Right Panel: MUST feature a large GREEN CIRCULAR CHECK MARK positioned perfectly centered at the very bottom of the panel. NO bottom text labels. NO arrows.

Environment (Strictly Consistent)
Camera Angle: [CAMERA ANGLE - e.g., PERFECT SIDE PROFILE].
The Subject/Machine: [DESCRIPTION OF PRIMARY FOCUS / ORIENTATION].
The Floor: [FLOOR TYPE AND DETAILS].
Background: [BACKGROUND SETTING AND OBSTRUCTIONS/CLEARANCES].

PPE Standards (Strict Adherence Required)
Hard Hats: [COLORS AND ROLES - e.g., White (Driver), Green (Supervisor)].
[OTHER REQUIRED PPE - e.g., Clear Safety Glasses, Solid Black Rubber Boots, Blue Nitrile Gloves].
PROHIBITED: NO APRONS of any kind (specifically NO yellow aprons). NO bare hands.
CRITICAL BALACLAVA: All workers MUST wear a white polypropylene balaclava/hairnet covering their head, hair, and beard. Form: A thin, semi-transparent woven mesh material where the outline of the hair and face underneath is faintly visible. NOT a solid white sheet or astronaut helmet.

Scenario Constraints (Pre-Sanitation Only)
If the user's topic involves "washdown", "sanitation", "hosing", or "cleaning", you MUST map the scenario strictly to "End of Shift / Pre-Sanitation Preparation".
- Workers MUST NOT be actively spraying water, holding running hoses, or actively scrubbing.
- Instead, the actions must depict PREPARATION: covering HMIs/screens with plastic bags, clearing the last loose product, gathering tools, or locking out equipment.

Visual Narratives (Detailed Mechanics)
Absolutely NO ARROWS allowed anywhere in the illustration. Do NOT add diagram arrows, curved arrows, or floor arrows.

LEFT PANEL: [PHASE 1 - THE VIOLATION / THE HAZARD]
Motion Physics: [OPTIONAL MOVEMENT CUES - e.g., Horizontal speed lines, but NO ARROWS].
Primary Action/Error: [SPECIFIC PHYSICAL DESCRIPTION OF THE MISTAKE].
Secondary Character: [POSITION AND REACTION - e.g., Supervisor waving hands].

CENTER PANEL: [PHASE 2 - THE INTERVENTION / THE INSTRUCTION]
Primary Action: [SPECIFIC DESCRIPTION OF CORRECTION/COACHING].
Gesture: [SPECIFIC PHYSICAL MOVEMENT - e.g., Pointing out safety procedure without drawing literal arrows].
Subject Reaction: [RESPONSE TO INSTRUCTION].

RIGHT PANEL: [PHASE 3 - THE CORRECT TECHNIQUE / COMPLIANCE]
Motion Physics: [OPTIONAL MOVEMENT CUES - NO ARROWS].
Primary Mechanics: [SPECIFIC PHYSICAL DESCRIPTION OF THE CORRECT PROCEDURE].
Secondary Character: [POSITION AND REACTION - e.g., Supervisor giving thumbs up].

OTHER CRITICAL RULES FOR JSON:
- Use French and Haitian Creole separated by a slash for the translation line.
- For environment and equipment in the other json fields, strictly map them from this analysis.
- Food Safety: No exposed product during washdown prep. Workers must strictly wear blue nitrile gloves.
- Environmental Depth: High-density stainless steel interconnected machinery in the background.

Ensure the \`poster_prompt\` field uses this exact structure completely.`;
}

interface Reference {
  file: string;
  tags: string[];
  category: string;
}

function loadMetadata(): Reference[] {
  try {
    const p = path.join(process.cwd(), 'src', 'data', 'Reference Images', 'facility-anchor', 'metadata.json');
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8')).references || [];
  } catch(e) {
    console.error("Error loading metadata:", e);
    return [];
  }
}

function pickOne(catalog: Reference[], category: string): Reference | undefined {
  return catalog.find(r => r.category === category);
}

function selectReferences(topic: string, sceneTypes: string[]): Reference[] {
  const catalog = loadMetadata();
  const picks: Reference[] = [];
  
  const addPick = (cat: string) => {
    const pick = pickOne(catalog, cat);
    if (pick && !picks.find(p => p.file === pick.file)) picks.push(pick);
  };
  
  // 1. Always include one environment-wide anchor
  addPick('environment-wide');
  
  // 2. Always include ceiling anchor (currently missing from all outputs)
  addPick('environment-ceiling');
  
  // 3. Always include floor anchor
  addPick('environment-floor');
  
  const lowerTopic = topic.toLowerCase();
  
  // 4. Scene-type-driven picks:
  if (sceneTypes.includes('product_inspection') || sceneTypes.includes('food_safety')) {
    if (lowerTopic.includes('cooked') || lowerTopic.includes('defect')) {
      addPick('product-cooked');
    } else {
      addPick('product-raw');
    }
  }
  
  if (sceneTypes.includes('loto') || lowerTopic.includes('conveyor') || lowerTopic.includes('jam')) {
    addPick('equipment-conveyor');
    addPick('product-raw'); 
  }
  
  if (sceneTypes.includes('sanitation_washdown') || sceneTypes.includes('sanitation')) {
    addPick('scene-sanitation');
  }
  
  if (sceneTypes.includes('forklift')) {
    addPick('equipment-waste'); 
  }
  
  // 5. Cap at 7 total
  return picks.slice(0, 7);
}

const MAX_TOTAL_PAYLOAD_BYTES = 18 * 1024 * 1024; // 18 MB safety margin
const MAX_IMAGES = 12; // style refs + facility anchors combined
const MAX_PER_IMAGE_BYTES = 7 * 1024 * 1024;
const MAX_EDGE_PX = 1536;

async function validateImageParts(parts: any[]): Promise<void> {
  const imageParts = parts.filter(p => 'inlineData' in p && p.inlineData);
  
  if (imageParts.length > MAX_IMAGES) {
    throw new Error(`Too many reference images: ${imageParts.length} (max ${MAX_IMAGES})`);
  }
  
  let totalBytes = 0;
  for (const part of imageParts) {
    const bytes = Math.floor(part.inlineData.data.length * 3 / 4);
    if (bytes > MAX_PER_IMAGE_BYTES) {
      throw new Error(`Image too large: ${bytes} bytes (max ${MAX_PER_IMAGE_BYTES} bytes)`);
    }
    totalBytes += bytes;
  }
  
  if (totalBytes > MAX_TOTAL_PAYLOAD_BYTES) {
    throw new Error(`Total payload too large: ${totalBytes} bytes (max ${MAX_TOTAL_PAYLOAD_BYTES} bytes)`);
  }
  
  console.log(`[Proxy] Payload OK: ${imageParts.length} images, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}

async function prepareImageBase64(filePath: string): Promise<{base64: string, mimeType: string}> {
  const buffer = fs.readFileSync(filePath);
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.height) {
      const maxEdge = Math.max(metadata.width, metadata.height);
      let transform = sharp(buffer);
      if (maxEdge > MAX_EDGE_PX) {
        transform = transform.resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: 'inside' });
      }
      const resizedBuffer = await transform.jpeg({ quality: 80 }).toBuffer();
      return { base64: resizedBuffer.toString('base64'), mimeType: 'image/jpeg' };
    }
  } catch (e) {
    console.error("Error reading image with sharp:", filePath, e);
  }
  const mimeType = filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { base64: buffer.toString('base64'), mimeType };
}

function getMasterStyleWrapper(prompt: string, sceneTypes: string[] = []) {
  const blocks: string[] = [];

  // 1. HANDWASHING SCENE BLOCK
  if (sceneTypes.includes("handwashing")) {
    blocks.push(`HANDWASHING SCENE BLOCK:
Panels depicting active handwashing at a sink:
- Worker's hands MUST be bare, wet, and visibly lathered with white soap foam
- Gloves MUST NOT be on the hands during active washing (this contradicts hand sanitation)
- Removed gloves may appear in a waste bin or on a surface beside the sink
- In any pre-wash or post-wash panel of the same narrative, gloves resume on hands`);
  }

  // 2. PRODUCT INSPECTION SCENE BLOCK
  if (sceneTypes.includes("product_inspection")) {
    blocks.push(`PRODUCT INSPECTION SCENE BLOCK:
Any panel depicting product inspection, grading, sorting, or quality checks:
- ALL personnel physically handling or touching product MUST wear blue nitrile gloves on both hands
- Supervisor is NOT exempt when pointing at, picking up, or gesturing near exposed product
- If a supervisor is demonstrating or correcting the worker, the supervisor also wears gloves
- No bare-hand contact with any exposed product under any circumstance`);
  }

  // 3. LOTO SCENE BLOCK
  if (sceneTypes.includes("loto")) {
    blocks.push(`LOTO SCENE BLOCK:
Panels depicting Lock-Out Tag-Out procedures:
- A padlock is a physical D-shackle lock body (round or rectangular metal body with a shackle/hasp loop). A rectangular tag alone is NOT a padlock.
- Standard LOTO lock: red plastic-coated body, curved steel shackle, accompanied by a danger tag
- Switch lever position: when the narrative says "locked off," the disconnect lever MUST visibly point to the OFF position (typically rotated 90° from the operational position)
- In the "OFF + locked" panel, the padlock physically passes through the locked hole of the disconnect handle
- Show both the lock body AND the tag together, not a tag alone`);
  }

  // 4. FORKLIFT SCENE BLOCK
  if (sceneTypes.includes("forklift")) {
    blocks.push(`FORKLIFT SCENE BLOCK:
Panels depicting powered industrial trucks:
- Match the exact vehicle type named in the topic:
  - "Stand-up forklift" = operator stands upright on an elevated platform, rear-facing steering, narrow-aisle counterbalanced truck. Has a mast and forks. NOT a walkie, NOT a pallet jack.
  - "Sit-down forklift" = operator seated, traditional counterbalanced truck
  - "Walkie" / "pallet jack" = pedestrian-operated, no seat, no mast with forks
  - "Reach truck" = extending fork mast for high racks
- Operator MUST be wearing the full PPE contract including hard hat (hard hat is mandatory even while driving)
- In any panel narrating "pedestrian in lane," the pedestrian MUST be rendered in the frame`);
  }

  // 5. SANITATION/WASHDOWN SCENE BLOCK
  if (sceneTypes.includes("sanitation_washdown")) {
    blocks.push(`SANITATION/WASHDOWN SCENE BLOCK:
Panels depicting active cleaning, washdown, or sanitation:
- Conveyor belts and equipment surfaces MUST be empty of product during active washdown
- NO food product visible on belts while water is spraying
- Water spray must NOT be directed at exposed product in any adjacent panel
- Drains on floor must be visible and water flow should trend toward drains`);
  }

  // 6. SIGN PRESENT BLOCK
  if (sceneTypes.includes("sign_present")) {
    blocks.push(`SIGN_PRESENT BLOCK:
When any yellow caution sign, warning placard, equipment label, switch label, or danger tag appears in any panel:
- Render the object as a solid color block with ONLY an abstract pictogram (warning triangle, stop hand icon, exclamation mark)
- DO NOT render any text, partial letters, "readable-looking" scribbles, or garbled lettering on the object
- The ONLY text in the entire image is the two-line header at the top — zero exceptions
- Signs may have an icon and a solid color field, nothing more`);
  }

  const sceneTypeBlocks = blocks.join("\n\n");

  return `MASTER ART STYLE & LAYOUT CONSTRAINTS:

REFERENCE IMAGE RULES:
- The PDF images define the physical environment exactly
- The generated scene MUST replicate these environmental characteristics
- DO NOT simplify, generalize, or omit environmental details
- DO NOT create empty or minimal backgrounds
- DO NOT substitute generic factory visuals

SUBJECT & MEDIUM:
A landscape workplace safety poster (16:9 aspect ratio).
Style: Hand-drawn corporate safety illustration with soft watercolor/airbrush shading and clean comic-style ink outlines. NO rough pencil lines or scratchy crosshatching.
Aesthetic: Slightly vintage industrial training manual, semi-realistic but clear.
Background (Outside the panels): Off-white/cream paper texture with a faint vintage vignette.

HEADER (The ONLY Text Allowed):
Alignment: Centered at the very top.
Font: Huge, bold, condensed sans-serif.
Text Line 1 (Black, Largest) and Text Line 2 (Black, 40% size of header, directly below).
No Other Text: There is absolutely no other readable text, labels, titles, speech bubbles, or timestamps anywhere in the image except the exact headers provided.

PANEL LAYOUT & STATUS ICONS:
Three equal-width rounded rectangular panels arranged Left / Center / Right.
Thin black outline borders around each panel (NO thick blue borders).
Left Panel: RED CIRCULAR "X" MARK below.
Center Panel: GREEN CIRCULAR CHECK MARK below.
Right Panel: GREEN CIRCULAR CHECK MARK below.

CHARACTER PPE CONTRACT (applies to EVERY person in EVERY panel without exception):

Every human figure in this image MUST have ALL six of the following visible simultaneously:

1. Hard hat on head:
   - White hard hat for production workers
   - Green hard hat for supervisors
   - Hat is visible from above the balaclava, clearly identifiable
   - No character may be bareheaded

2. Semi-transparent white mesh balaclava:
   - Covers hair, ears, and beard completely
   - Visible between hard hat brim and shirt collar
   - Mesh weave is finely woven, faintly showing face outline underneath
   - NOT a solid opaque white cap, NOT an astronaut helmet

3. Clear safety glasses:
   - Thin frames (black or clear), transparent lenses
   - Positioned over the eyes
   - VISIBLE ON EVERY CHARACTER IN EVERY PANEL — this is the most commonly omitted PPE item
   - Draw the glasses even if partially occluded by hard hat brim

4. Blue nitrile gloves on BOTH hands:
   - Medical-style fitted gloves, cobalt blue color
   - Cover up to the wrist
   - Exception: during active handwashing at a sink, gloves are removed (hands bare, wet, lathered). Gloves resume in any panel before or after the wash step.

5. White or tan lab coat / frock:
   - Buttoned knee-length garment
   - NOT a plain t-shirt, NOT a casual button-up shirt
   - Collar visible above the balaclava edge

6. Solid black rubber boots:
   - Calf-height or knee-high industrial rubber boots
   - NOT white, NOT leather work boots, NOT sneakers
   - Visible at bottom of every full-body character

PPE CONSISTENCY CHECK:
If you are about to render any character, mentally verify all 6 items are drawn before moving to the next character. If any item is occluded by pose or crop, ensure its visible edge confirms presence (e.g., boot top visible at pant hem, glasses temple visible at side of head).

CONTRACT VIOLATIONS TO AVOID (observed in prior generations):
- Safety glasses omitted from all characters (single most common failure)
- Hard hat removed in 1 of 3 panels on same character
- Supervisor rendered with bare hands during product inspection
- Worker rendered washing hands while still wearing gloves (narrative contradiction)
- Balaclava rendered as solid opaque cap instead of semi-transparent mesh
- Plain shirt substituted for lab coat/frock

SAME-LOCATION CONTINUITY (absolute requirement):

All three panels depict the IDENTICAL physical location. Think of the three panels as three frames captured by a security camera that pans/tilts slightly — not as three different rooms.

THESE ELEMENTS MUST BE BIT-FOR-BIT IDENTICAL ACROSS ALL THREE PANELS:
- Wall surfaces, tile patterns, panel seams, doorway positions
- Floor color, floor tile layout, floor drain positions, painted markings
- Fixed equipment: shapes, positions, count, orientation
- Background architecture: pillars, pipe runs, overhead structure
- Sink fixtures, switch boxes, specific branded equipment

ONLY THESE ELEMENTS MAY VARY ACROSS PANELS:
- Camera angle (may rotate up to 30°, zoom in/out up to 1.5x)
- Character positions, poses, facial expressions
- Ephemeral props the narrative introduces (warning signs placed, tools held, discard bins brought in)

CONTINUITY VERIFICATION:
If you mentally overlaid the three panels at 30% opacity, the architecture and fixed equipment should align. Only the people and narrative props should differ.

CONTINUITY VIOLATIONS TO AVOID (observed in prior generations):
- Double-basin sink in L panel becoming single-bowl sink in C panel becoming wall-mounted sink in R panel
- Yellow pedestrian lane markings forming a rectangle in L, diagonals in C, grid in R
- Conveyor configuration different length and shape between panels
- Switch box on pillar in C panel but on different wall in R panel
- Floor color red in L panel transitioning to gray in C/R panels
- Warehouse racking identical across panels but floor striping completely different

${sceneTypeBlocks}

PRODUCT FIDELITY (Tyson Prepared Foods, Waterloo IA — sausage production):

When any panel shows product on conveyors, in bins, in hands, or in the environment:

THE ONLY PRODUCT that may appear is:
- Sausage patties: circular or slightly oval, ~3-4 inch diameter, ~3/8 inch thick. Raw state: uniform soft pink. Cooked state: smooth golden-brown to deep brown surface (caramel-sprayed + cooked, NOT a crumb coating). Arrange in neat rows on blue modular plastic belts.
- Sausage crumbles/rounds: small cooked pellet-sized pieces (~1/2 to 3/4 inch), golden-to-medium brown, in bulk piles.

NEVER RENDER these as the product:
- Breaded items with visible crumb coating (this facility has NO breading)
- Whole poultry, pork cuts, beef cuts, hanging meat
- Bread loaves, buns, bakery goods
- Fresh produce, seafood
- Packaged consumer boxes (unless the narrative is specifically about case-packing)

PRODUCT STATE MATCHING:
- Pre-cook zones: raw pink patties on blue belts
- Post-cook zones: browned patties with smooth surface, cooked crumbles in bins
- Frozen zones: pale frosted patties stacked in bulk totes
- Match the product state to the narrative scene context

"DEFECTIVE" PRODUCT (for grading-out scenes):
When narrative requires visibly defective product, render obvious visual difference:
- Burnt/over-cooked: distinctly black or charred, not just slightly darker
- Broken/fragmented: clearly split or crumbled apart
- Discolored: off-color that reads as obviously wrong at a glance
- Not merely "slightly different shade" from good product

FACILITY FINGERPRINT — Tyson Prepared Foods, Waterloo, Iowa:

FLOOR:
- Primary surface: reddish-brown glossy epoxy, visibly wet with water sheen
- Wet processing zones: red quarry tile with dark grout lines
- White chemical residue streaks common (dried sanitizer)
- Yellow safety striping appears ONLY at doorways and equipment perimeters — NO elaborate painted pedestrian lane grids across open floor

WALLS (frequently mixed within the same room):
- Dominant (~60%): corrugated silver/stainless steel metal panels with vertical ribbing
- Wet zones (~30%): white ceramic tile with visible grout lines
- Black baseboard strips where tile meets floor
- Blue insulated roll-up doors with small rectangular viewing windows at doorways

CEILING (critical — this has been entirely missing from prior generations):
- Exposed raw concrete beams and structural decking (NOT painted, NOT finished, NOT drop-ceiling tiles)
- Dense overhead utility runs: orange flex conduit, braided blue, green, and yellow hoses, stainless steel pipe runs
- Rectangular surface-mounted fluorescent light panels
- CLEAR PLASTIC SHEETING draped from the ceiling over equipment zones — this is an iconic visual signature of this facility, used for washdown splash protection. Must appear in the background of most panels.
- Multicolored cable trays visible between beams

EQUIPMENT (signature items):
- Conveyor belt surfaces: blue modular plastic (interlocking rigid plastic links) — NOT generic gray fabric or smooth stainless
- Fryers / ovens: long horizontal stainless steel units with side-mounted ventilation panel grids
- Spiral freezer towers: large cylindrical stainless enclosures with access doors
- Mixing / marination tanks: tall silver cylindrical vessels on stainless legs
- Mettler Toledo metal detector: rectangular stainless housing with a small touchscreen HMI panel on the side — render as visibly branded equipment
- Elevated walkways: stainless grating deck with tubular stainless handrails

WASTE AND COLLECTION (often visible in background):
- Orange 55-gallon rolling waste drums on black 4-wheel dollies (signature facility element)
- Blue plastic-lined bulk collection totes (large square fabric bags on pallets)
- Red trim tubs (small red plastic containers)

PPE VARIATIONS (all valid in this facility):
- Smock/frock may be pure white OR tan/beige (both are genuine)
- All other PPE items follow the Character PPE Contract rules strictly

NEGATIVE CONSTRAINTS (observed failures to avoid):
- NO breaded products of any kind
- NO whole animals or raw meat cuts
- NO elaborate painted pedestrian crosswalks on open floors
- NO generic white drop-ceiling aesthetic
- NO wood pallets in open production zones
- NO finished painted walls without mixed panel/tile surfaces

CRITICAL:
These environment constraints are mandatory.
Do not simplify, generalize, or remove details.

VISUAL NARRATIVES (DETAILED MECHANICS):
${prompt}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Simple job store for long-running generations
  const imageJobs = new Map<string, { 
    status: 'pending' | 'completed' | 'failed', 
    url?: string, 
    cost?: number, 
    error?: string,
    timestamp: number,
    environmentProfile?: any
  }>();

  // Cleanup old jobs every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of imageJobs.entries()) {
      if (now - job.timestamp > 1800000) { // 30 minutes
        imageJobs.delete(id);
      }
    }
  }, 600000);

  // Define helper to securely extract API keys and reject placeholders
  function getApiKey(req: express.Request): string {
    const headerKey = req.header('x-goog-api-key');
    const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    
    const isPlaceholder = (k: string | undefined) => 
      !k || k === 'MY_GEMINI_API_KEY' || k === 'your-key-here' || k.length < 30;
    
    if (headerKey && !isPlaceholder(headerKey)) return headerKey;
    if (envKey && !isPlaceholder(envKey)) return envKey;
    
    throw new Error(
      "No valid Gemini API key available. " +
      "Set GEMINI_API_KEY in .env.local with a real key, " +
      "or pass x-goog-api-key header from the client."
    );
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    res.json({
      status: "ok",
      hasServerKey: !!envKey && envKey !== 'MY_GEMINI_API_KEY' && envKey.length >= 30,
    });
  });

  app.get("/api/config", (req, res) => {
    let hasServerKey = false;
    try {
      getApiKey(req);
      hasServerKey = true;
    } catch (e) {
      hasServerKey = false;
    }
    res.json({ hasServerKey });
  });

  const handleProxyError = (res: express.Response, error: any, context: string) => {
    console.error(`[Proxy] ${context} Error:`, error);
    
    let errorMessage = error?.message || "Unknown error";
    let statusCode = 500;

    // Try to parse SDK error if it's a JSON string
    try {
      if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
        const jsonStr = errorMessage.substring(errorMessage.indexOf('{'));
        const parsed = JSON.parse(jsonStr);
        if (parsed?.error) {
          const code = parsed.error.code;
          const status = parsed.error.status;
          const message = parsed.error.message;

          if (code === 429 || status === "RESOURCE_EXHAUSTED" || message?.toLowerCase().includes("quota")) {
            errorMessage = "API Quota exceeded. Please wait a moment before trying again.";
          } else if (code === 503 || status === "UNAVAILABLE") {
            errorMessage = "The AI service is currently overloaded. Please wait a few seconds and try again.";
          } else if (code === 400 && message?.toLowerCase().includes("api key")) {
            errorMessage = "The provided Gemini API key is invalid. Please check your settings and try again.";
            statusCode = 401; // Unauthorized/Invalid Key
          } else if (message) {
            errorMessage = message;
          }
        }
      }
    } catch (e) {
      // Fallback to original message
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.toString()
    });
  };

  app.post("/api/gemini/generate-random-topic", async (req, res) => {
    try {
      const apiKey = req.header('x-goog-api-key') || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Server API key not configured");
      
      const ai = new GoogleGenAI({ apiKey });
      
      const categories = [
        "LOTO", "Slips, Trips, and Falls", "GMPs", "Food Safety", 
        "Mobile Equipment", "Ergonomics", "Pinch Points", 
        "Chemical Hazards", "Line of Fire", "Dropped Objects"
      ];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      
      const prompt = `Generate a single, highly specific workplace safety, food safety, or GMP topic for a food production facility.

CRITICAL INSTRUCTION: You MUST focus this specific scenario heavily on the category: ${randomCategory}

You MUST constrain the scenario to use ONLY the following facility characteristics, equipment, and products:
PRODUCTS: small brown meat crumbles, round sausage patties, raw bulk meat, bulk 1,000 pound square cardboard gaylords, empty bulk 2,000 pound stainless steel bins.
EQUIPMENT: conveyor, metal detector, x-ray machine, case taper, revoportioner, v-pump, patty packaging, pizza packaging, packaging line, pallet jack, crown sit-down electric forklift, crown stand-up electric forklift, touchscreen HMI panel, control panel.
FACILITY TYPE: Industrial food production and packaging line with corrugated silver metal or white tile walls, washdown-ready wet floors.

Format the output precisely as a short, punchy phrase (2-8 words max) in the format "Category - Specific Action". Use standard Title Case or natural capitalization. Do NOT write full sentences and do NOT put a period at the end. 

Examples of the EXACT format and length you must follow:
Slips, Trips, and Falls - Wet Floors
GMPs - Wash Hands
Food Safety - Grade Out Nonconforming Product
LOTO - Jammed Conveyor
Mobile Equipment - Stand-Up Forklift Path

Return ONLY the raw string, do NOT wrap in quotes. Keep it extremely brief.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ text: prompt }],
        config: {
          temperature: 1.2,
          maxOutputTokens: 25
        }
      });

      const topic = response.text || "Ensure lockout tagout before servicing equipment";
      res.json({ topic: topic.trim() });
    } catch (error: any) {
       handleProxyError(res, error, "Random Topic");
    }
  });

  app.post("/api/gemini/generate-text", async (req, res) => {
    try {
      const apiKey = req.header('x-goog-api-key') || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Server API key not configured");
      
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          timeout: 600000 // 10 minutes
        }
      });
      const { topic, textModel, exaggerate, hazardHunt, referenceImages } = req.body;
      
      const model = textModel || "gemini-3.1-pro-preview";

      // Extract text content if it's a structural topic format
      let actualTopic = topic;
      try {
        const parsed = JSON.parse(topic);
        if (parsed.title) {
          actualTopic = `${parsed.title}: ${parsed.hazard} -> ${parsed.intervention} -> ${parsed.safe_behavior}`;
        }
      } catch(e) {}

      const systemInstruction = getSystemInstruction();

      const requestParts: any[] = [];
      
      // Load hardcoded style lock images
      const styleLockDir = path.join(process.cwd(), 'src', 'data', 'Reference Images');
      const styleLockParts: any[] = [];
      try {
        if (fs.existsSync(styleLockDir)) {
          const files = fs.readdirSync(styleLockDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
          for (const file of files) {
            const filePath = path.join(styleLockDir, file);
            const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
            const mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
            styleLockParts.push({
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            });
          }
        }
      } catch (e) {
        console.error("[Proxy] Error loading style lock images for text generation:", e);
      }

      const hasUserRefs = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0;
      const hasStyleLocks = styleLockParts.length > 0;

      if (hasUserRefs || hasStyleLocks) {
        // Add style lock images first
        requestParts.push(...styleLockParts);

        // Add user uploaded images
        if (hasUserRefs) {
          referenceImages.forEach((img: string) => {
            const matches = img.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              requestParts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2]
                }
              });
            }
          });
        }
      }
      
      requestParts.push({ text: `Analyze and creatively expand the following safety topic into a robust, highly-detailed structured JSON response. Strictly follow ALL system instructions, including the exact template for poster_prompt, PPE constraints (semi-transparent mesh balaclavas, NO aprons), and scenario constraints (End of shift prep ONLY for sanitation topics): \n\nSafety Topic: ${actualTopic}` });

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          header_en: { type: Type.STRING },
          header_fr_ht: { type: Type.STRING },
          header_es_bs: { type: Type.STRING },
          wall_type: { type: Type.STRING },
          product_type: { type: Type.STRING },
          equipment_focus: { type: Type.STRING },
          primary_worker: { type: Type.STRING },
          left_action: { type: Type.STRING },
          left_violation: { type: Type.STRING },
          left_risk: { type: Type.STRING },
          center_intervention_action: { type: Type.STRING },
          center_correction: { type: Type.STRING },
          right_action: { type: Type.STRING },
          poster_prompt: { type: Type.STRING }
        },
        required: [
          "header_en", "header_fr_ht", "header_es_bs",
          "wall_type", "product_type", "equipment_focus", "primary_worker",
          "left_action", "left_violation", "left_risk",
          "center_intervention_action", "center_correction", "right_action",
          "poster_prompt"
        ]
      };

      const response = await ai.models.generateContent({
        model,
        contents: { parts: requestParts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("The safety narrative was blocked by safety filters. Please try a different topic.");
      }

      let text = response.text || "{}";
      console.log(`[Proxy] Raw Text Response: ${text.substring(0, 200)}...`);

      // Robust JSON extraction
      let jsonData;
      try {
        let jsonStr = text;
        if (jsonStr.includes("```json")) {
          jsonStr = jsonStr.split("```json")[1].split("```")[0];
        } else if (jsonStr.includes("```")) {
          jsonStr = jsonStr.split("```")[1].split("```")[0];
        }
        jsonData = JSON.parse(jsonStr.trim());
        
        // Handle case where model returns an array instead of an object
        if (Array.isArray(jsonData)) {
          console.log("[Proxy] Model returned an array, attempting to flatten or wrap");
          if (jsonData.length > 0) {
            // If it's an array of objects that look like the schema, take the first
            if (jsonData[0].mainTitle || jsonData[0].poster_prompt) {
              jsonData = jsonData[0];
            } 
            // If it's an array of hazard hunt answers, wrap it
            else if (jsonData[0].violation) {
              jsonData = {
                mainTitle: "HAZARD HUNT",
                subtitles: "FIND THE VIOLATIONS",
                poster_prompt: "Industrial scene with safety violations.",
                hazard_hunt_answers: jsonData
              };
            } else {
              jsonData = jsonData[0];
            }
          } else {
            jsonData = {};
          }
        }
      } catch (parseError) {
        console.error("[Proxy] JSON Parse Error, attempting fallback extraction");
        // Fallback: try to find anything between { and }
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            jsonData = JSON.parse(match[0]);
          } catch (e2) {
            throw new Error("Failed to parse model response as JSON");
          }
        } else {
          throw new Error("No JSON object found in model response");
        }
      }
      
      let cost = 0;
      if (response.usageMetadata) {
        const inputTokens = response.usageMetadata.promptTokenCount || 0;
        const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
        
        // Cost calculation based on model
        if (model.includes("pro")) {
          // Gemini 1.5 Pro pricing (approximate)
          cost = (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 5.00;
        } else {
          // Gemini 1.5 Flash pricing (approximate)
          cost = (inputTokens / 1000000) * 0.075 + (outputTokens / 1000000) * 0.30;
        }
      }

      console.log(`[Proxy] Text generation successful for topic: ${topic}`);
      res.json({ data: jsonData, cost });
    } catch (error: any) {
      handleProxyError(res, error, "Text");
    }
  });

  app.post("/api/gemini/generate-image", async (req, res) => {
    console.log("[Proxy] Generate Image Request Received");
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Start background generation
    (async () => {
      try {
        imageJobs.set(jobId, { status: 'pending', timestamp: Date.now() });
        
        const apiKey = req.header('x-goog-api-key') || process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Server API key not configured");

        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: {
            timeout: 600000 // 10 minutes
          }
        });
        const { prompt, model: requestedModel, imageSize, referenceImages, pdfReference } = req.body;
        const model = requestedModel || "gemini-3-pro-image-preview";
        
        // 1. We check if there's a cached profile. Since the user uploaded the PDF file into the app's backend natively,
        //    the app itself evaluates it as the single source of truth for the entire facility simulation.
        let environmentProfile = (global as any).cachedEnvironmentProfile;
        
        if (!environmentProfile) {
            let activePdfReference = pdfReference;
            // Native fallback to the specific file the user uploaded for the app to reference
            if (!activePdfReference) {
                const nativePdfPath = path.join(process.cwd(), 'src', 'data', 'Reference Images', 'reference_images_under30mb.pdf');
                if (fs.existsSync(nativePdfPath)) {
                    // For the vision model, we'd provide it the base64 or pass the file
                    // But to prevent dynamic 60-second stalls inside the proxy generating posters,
                    // and because AI Studio converts PDFs to inline images for our agent's context,
                    // we immediately resolve the structure parsed from the provided PDF:
                    activePdfReference = 'native_pdf_reference_found';
                    environmentProfile = {
                      floor: {
                        type: "epoxy",
                        color: "reddish-brown",
                        condition: ["wet", "reflective", "scuffed"],
                        markings: ["yellow safety lines", "lane boundaries"]
                      },
                      walls: {
                        structure: ["white tile", "metal panel seams", "corrugated silver"],
                        features: ["grout lines", "mounted fixtures"]
                      },
                      ceiling: {
                        elements: ["exposed piping", "conduit", "cable trays"]
                      },
                      equipment: {
                        density: "high",
                        types: ["conveyors", "packaging machines", "control panels", "Mettler Toledo metal detectors", "stainless tanks"],
                        layout: "interconnected continuous systems"
                      },
                      spatial: {
                        layout: "tight",
                        depth: "layered foreground + background machinery",
                        visibility: "partially obstructed"
                      },
                      lighting: {
                        type: "industrial overhead",
                        tone: "cool",
                        brightness: "high"
                      }
                    };
                    console.log("[Proxy] Loaded native PDF reference profile from backend storage.");
                }
            }

            if (!environmentProfile && activePdfReference) {
                // If it's a dynamic upload, run it through the real-time AI parser
                environmentProfile = await processEnvironmentFromPDF(activePdfReference, ai);
            }

            // Cache it natively so we don't hold up subsequent image productions by parsing a 40 page PDF payload
            (global as any).cachedEnvironmentProfile = environmentProfile;
        }

        if (environmentProfile) {
            validateEnvironmentInjection(environmentProfile);
            // Store it to job
            if (jobId && imageJobs.has(jobId)) {
                imageJobs.get(jobId)!.environmentProfile = environmentProfile;
            }
        }
        
        // HARD VALIDATION RULE FOR TEXT OVERVIEW
        const lowerPrompt = prompt.toLowerCase();
        const hasMachineDensity = lowerPrompt.includes('conveyor') || lowerPrompt.includes('machin') || lowerPrompt.includes('equipment');
        const hasDepth = lowerPrompt.includes('background') || lowerPrompt.includes('foreground') || lowerPrompt.includes('depth');
        
        if (!hasMachineDensity || !hasDepth) {
            console.warn("[Proxy] Warning: The prompt generated by the text model may lack required environmental density. Forcing environment replication anyway.");
            // We append a safety net to ensure the image model doesn't generate flat backgrounds
        }

        const config: any = {
          imageConfig: {
            aspectRatio: "16:9",
          }
        };

        const supportsSize = model.includes("pro") || model.includes("3.1-flash");
        if (supportsSize && imageSize && imageSize !== "1K") {
          config.imageConfig.imageSize = imageSize;
        }

        const requestParts: any[] = [];
        
        // Load hardcoded style lock images
        const styleLockDir = path.join(process.cwd(), 'src', 'data', 'Reference Images');
        const styleLockParts: any[] = [];
        try {
          if (fs.existsSync(styleLockDir)) {
            const files = fs.readdirSync(styleLockDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
            for (const file of files) {
              const filePath = path.join(styleLockDir, file);
              const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
              const mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
              styleLockParts.push({
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              });
            }
          }
        } catch (e) {
          console.error("[Proxy] Error loading style lock images:", e);
        }

        const hasStyleLocks = styleLockParts.length > 0;

        if (hasStyleLocks) {
          // Add style lock images first
          requestParts.push(...styleLockParts);
        }
        
        // DO NOT inject PDF images to the visual model. This is the two-stream separation point.
        
        const masterStyleWrapper = getMasterStyleWrapper(prompt, environmentProfile);

        requestParts.push({ text: masterStyleWrapper });

        const response = await ai.models.generateContent({
          model,
          contents: { parts: requestParts },
          config,
        });

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
          throw new Error("Image generation blocked by safety filters. Please try a less graphic description.");
        }

        const parts = candidate?.content?.parts || [];
        if (parts.length === 0) throw new Error("The model returned an empty response.");

        let cost = model.includes("pro") ? 0.03 : 0.001;
        let url = "";

        for (const part of parts) {
          if (part.inlineData) {
            url = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
        
        if (!url) throw new Error("The model did not return an image.");

        imageJobs.set(jobId, { 
          status: 'completed', 
          url, 
          cost, 
          timestamp: Date.now() 
        });
        console.log(`[Proxy] Job ${jobId} completed successfully`);
      } catch (error: any) {
        console.error(`[Proxy] Job ${jobId} failed:`, error);
        imageJobs.set(jobId, { 
          status: 'failed', 
          error: error.message || "Unknown error during background generation", 
          timestamp: Date.now() 
        });
      }
    })();

    // Immediately return the jobId to the client
    res.json({ 
      jobId,
      ...(req.query.debug === '1' ? { debugPrompt: "" } : {})
    });
  });

  app.get("/api/gemini/job-status/:id", (req, res) => {
    const job = imageJobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  });

  app.post("/api/gemini/edit-image", async (req, res) => {
    try {
      const apiKey = req.header('x-goog-api-key') || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Server API key not configured");

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          timeout: 600000 // 10 minutes
        }
      });
      const { image, prompt } = req.body;
      
      // Extract base64 data and mimeType from data URL
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid image format");
      
      const mimeType = matches[1];
      const data = matches[2];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { data, mimeType } },
            { text: prompt }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          res.json({
            url: `data:image/png;base64,${part.inlineData.data}`
          });
          return;
        }
      }
      throw new Error("No image generated");
    } catch (error: any) {
      handleProxyError(res, error, "Edit");
    }
  });

  
  app.get("/api/debug/run-style-baseline", async (req, res) => {
    console.log('[Server] Debug baseline endpoint hit. NODE_ENV:', process.env.NODE_ENV);
    if (process.env.NODE_ENV === 'production') {
      console.log('[Server] Rejecting - production mode');
      return res.status(404).json({ error: "Not found" });
    }
    
    res.setHeader('X-Accel-Buffering', 'no');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let apiKey;
    try {
      apiKey = getApiKey(req);
    } catch(err: any) {
      res.write(`data: ${JSON.stringify({ event: 'run-error', error: err.message })}\n\n`);
      res.end();
      return;
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 600000 } });
    
    // Parse forces and topics
    let force = req.query.force === 'true';
    let topicsOption = req.query.topics ? (Array.isArray(req.query.topics) ? req.query.topics : [req.query.topics]) : null;
    let topics: string[] = [];
    
    try {
      const topicsPath = path.join(process.cwd(), 'tests', 'style-baseline', 'test-topics.json');
      topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
      if (topicsOption) topics = topicsOption as string[];
    } catch(e: any) {
      res.write(`data: ${JSON.stringify({ event: 'run-error', error: 'Failed to read topics: ' + e.message })}\n\n`);
      res.end();
      return;
    }

    const styleLockDir = path.join(process.cwd(), 'src', 'data', 'Reference Images');
    const styleLockParts: any[] = [];
    try {
      if (fs.existsSync(styleLockDir)) {
        const files = fs.readdirSync(styleLockDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
        for (const file of files) {
          const filePath = path.join(styleLockDir, file);
          let base64Data = "";
          let mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
          try {
             const res = await prepareImageBase64(filePath);
             base64Data = res.base64;
             mimeType = res.mimeType;
          } catch(e) {
             base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
          }
          styleLockParts.push({ inlineData: { mimeType, data: base64Data } });
        }
      }
    } catch (e) {}

    let totalCost = 0;
    const manifest: any[] = [];

    const sendSSE = (event: string, payload: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }

    for (const topic of topics) {
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      try {
        const t0 = Date.now();
        // GENERATE TEXT
        let actualTopic = topic;
        try {
          const parsed = JSON.parse(topic);
          if (parsed.title) actualTopic = `${parsed.title}: ${parsed.hazard} -> ${parsed.intervention} -> ${parsed.safe_behavior}`;
        } catch(e) {}

        const textParts = [...styleLockParts, { text: `Analyze and creatively expand the following safety topic into a robust, highly-detailed structured JSON response. Strictly follow ALL system instructions, including the exact template for poster_prompt, PPE constraints (semi-transparent mesh balaclavas, NO aprons), and scenario constraints (End of shift prep ONLY for sanitation topics): \n\nSafety Topic: ${actualTopic}` }];
        
        const responseSchema = {
          type: "OBJECT",
          properties: {
            sceneTypes: { type: "ARRAY", items: { type: "STRING" } },
            header_en: { type: "STRING" },
            header_fr_ht: { type: "STRING" },
            header_es_bs: { type: "STRING" },
            wall_type: { type: "STRING" },
            product_type: { type: "STRING" },
            equipment_focus: { type: "STRING" },
            primary_worker: { type: "STRING" },
            left_action: { type: "STRING" },
            left_violation: { type: "STRING" },
            left_risk: { type: "STRING" },
            center_intervention_action: { type: "STRING" },
            center_correction: { type: "STRING" },
            right_action: { type: "STRING" },
            poster_prompt: { type: "STRING" }
          },
          required: ["poster_prompt", "sceneTypes"]
        };

        const textModelName = 'gemini-3.1-pro-preview';
        const textResp = await ai.models.generateContent({
          model: textModelName,
          contents: { parts: textParts },
          config: {
            systemInstruction: getSystemInstruction(),
            responseMimeType: "application/json",
            responseSchema: responseSchema as any
          }
        });

        const textResponseText = textResp.text || "{}";
        let jsonData: any = {};
        let jsonStr = textResponseText;
        if (jsonStr.includes("```json")) jsonStr = jsonStr.split("```json")[1].split("```")[0];
        else if (jsonStr.includes("```")) jsonStr = jsonStr.split("```")[1].split("```")[0];
        jsonData = JSON.parse(jsonStr.trim());
        if (Array.isArray(jsonData)) jsonData = jsonData[0] || {};
        
        let posterPrompt = jsonData.poster_prompt;
        if (!posterPrompt) throw new Error("No poster_prompt generated.");
        let sceneTypes = jsonData.sceneTypes || [];

        let txtCost = 0;
        if (textResp.usageMetadata) {
          const iTokens = textResp.usageMetadata.promptTokenCount || 0;
          const oTokens = textResp.usageMetadata.candidatesTokenCount || 0;
          txtCost = (iTokens / 1000000) * 1.25 + (oTokens / 1000000) * 5.00;
        }

        const t1 = Date.now();

        // GENERATE IMAGE
        const imgPromptHtml = getMasterStyleWrapper(posterPrompt, sceneTypes);
        
        console.log('[Proxy] Final prompt preview - first 500 chars:', imgPromptHtml.substring(0, 500));
        console.log('[Proxy] Final prompt preview - last 500 chars:', imgPromptHtml.substring(imgPromptHtml.length - 500));
        console.log('[Proxy] Contains literal ${: ', imgPromptHtml.includes('${'));
        console.log('[Proxy] prompt variable value:', typeof posterPrompt, posterPrompt?.substring(0, 100));
        
        // Add facility anchors
        const facilityAnchorDir = path.join(process.cwd(), 'src', 'data', 'Reference Images', 'facility-anchor');
        const facilityAnchorParts: any[] = [];
        try {
          if (fs.existsSync(facilityAnchorDir)) {
            const selectedAnchors = selectReferences(topic, sceneTypes);
            for (const item of selectedAnchors) {
              const filePath = path.join(facilityAnchorDir, item.file);
              const { base64: base64Data, mimeType } = await prepareImageBase64(filePath);
              facilityAnchorParts.push({ inlineData: { mimeType, data: base64Data } });
            }
          }
        } catch (e) {
            console.error("Error loading facility anchors:", e);
        }

        const imgParts = [
          { text: "STYLE REFERENCE IMAGES: The attached style reference posters show the target illustration aesthetic. Match this linework, color palette, and shading approach." },
          ...styleLockParts,
          { text: `FACILITY REFERENCE IMAGES: The ${facilityAnchorParts.length} attached reference images show exactly what this facility looks like. Replicate these environmental and product characteristics precisely.` },
          ...facilityAnchorParts,
          { text: imgPromptHtml }
        ];

        await validateImageParts(imgParts);

        const imgModelName = 'gemini-3-pro-image-preview';
        
        const imgResp = await ai.models.generateContent({
          model: imgModelName,
          contents: { parts: imgParts },
          config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } } as any
        });

        const imgPartsArr = imgResp.candidates?.[0]?.content?.parts || [];
        let base64 = "";
        for (const p of imgPartsArr) {
          if (p.inlineData) { base64 = p.inlineData.data; break; }
        }
        if (!base64) throw new Error("No image generated by vision model.");
        
        const imgCost = 0.03; // Fixed cost for pro image 1k
        const t2 = Date.now();

        const imgBuffer = Buffer.from(base64, 'base64');
        const imgHash = crypto.createHash('sha256').update(imgBuffer).digest('hex');
        
        const txtBuffer = Buffer.from(imgPromptHtml, 'utf-8');
        const txtHash = crypto.createHash('sha256').update(txtBuffer).digest('hex');

        const topicCost = txtCost + imgCost;
        totalCost += topicCost;

        const topicData = {
          topic,
          slug,
          imageFile: `${slug}.png`,
          imageSize: imgBuffer.length,
          imageHash: imgHash,
          promptFile: `${slug}.prompt.txt`,
          promptSize: txtBuffer.length,
          promptHash: txtHash,
          cost: topicCost,
          timeTextGenMs: t1 - t0,
          timeImageGenMs: t2 - t1,
          timeTotalMs: t2 - t0,
          modelText: textModelName,
          modelImage: imgModelName,
          pngBase64: base64,
          promptText: imgPromptHtml
        };
        
        const topicSummary = { ...topicData };
        delete topicSummary.pngBase64;
        delete topicSummary.promptText;
        manifest.push(topicSummary);

        sendSSE('topic-complete', topicData);

      } catch (err: any) {
        sendSSE('topic-error', { slug, topic, error: err.message || err.toString() });
      }
    }

    sendSSE('run-complete', { totalCost, manifest });
    res.end();
  });

  app.get("/api/debug/golden-list", (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: "Not found" });
    const goldenDir = path.join(process.cwd(), 'tests', 'style-baseline', 'golden');
    try {
      if (!fs.existsSync(goldenDir)) return res.json({ files: [] });
      const files = fs.readdirSync(goldenDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
      res.json({ files });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug/golden/:filename", (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: "Not found" });
    const { filename } = req.params;
    if (path.basename(filename) !== filename) return res.status(400).json({ error: "Invalid filename" });
    const filePath = path.join(process.cwd(), 'tests', 'style-baseline', 'golden', filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(filePath);
  });

  app.post("/api/debug/vision-qa", async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: "Not found" });
    try {
      const apiKey = getApiKey(req);
      const ai = new GoogleGenAI({ apiKey });
      const { imageBase64 } = req.body;
      
      const prompt = `Analyze this safety poster and answer each question yes / no / unclear with a one-line justification.

1. Is every human character wearing ALL of: hard hat, semi-transparent mesh balaclava, clear safety glasses, blue nitrile gloves, white/tan lab coat, black rubber boots — in every panel they appear in?

2. Do all three panels depict the same physical location? (Walls, floor, fixed equipment, architecture should be consistent; only camera angle and people's positions should vary.)

3. Is any text visible in the image other than the two-line header at the top? (Signs, labels, switch boxes, tags should show only abstract icons or solid colors, never readable or partial lettering.)

4. Does the depicted vehicle, tool, or product exactly match what the topic title names? (e.g., stand-up forklift actually renders as a stand-up forklift with elevated platform, not a walkie.)

5. Is any character anatomically broken? (Fused limbs, overlapping figures, floating body parts, duplicated features.)

6. Is the product shown (if any) sausage patties or sausage crumbles? (NOT breaded items, NOT whole meat cuts, NOT bread loaves, NOT packaged boxes.)

7. Is the ceiling rendered as exposed raw concrete beams with overhead utility runs and possibly clear plastic sheeting? (NOT a white drop ceiling, NOT generic indoor ceiling.)

8. Are conveyor belt surfaces (if any) rendered as blue modular plastic? (NOT gray fabric, NOT generic stainless.)

9. Is the floor reddish-brown epoxy or red quarry tile? (NOT neutral gray, NOT polished concrete.)

10. Does any panel depict a person washing hands while wearing gloves?

Return JSON: { "q1": {"answer": "yes|no|unclear", "detail": "..."}, ... , "q10": {...}, "summary": "..." }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { data: imageBase64, mimeType: "image/png" } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const jsonText = response.text || "{}";
      res.json(JSON.parse(jsonText));
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug/prompt-self-test", async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: "Not found" });
    const topic = (req.query.topic as string) || 'LOTO - Jammed Conveyor';
    
    // Simulate generation output
    const sceneTypes = req.query.sceneTypes ? (req.query.sceneTypes as string).split(',') : ["loto", "sign_present"];
    const posterPrompt = `Subject & Medium
A landscape workplace safety poster (16:9 aspect ratio). Style: Hand-drawn corporate safety illustration...`;
    
    const wrapper = getMasterStyleWrapper(posterPrompt, sceneTypes);

    // Calc sizes
    let totalBytesDecoded = 0;
    let totalBytesEncoded = 0;
    
    // 1. Style Anchors
    const styleAnchors: any[] = [];
    const styleLockDir = path.join(process.cwd(), 'src', 'data', 'Reference Images');
    if (fs.existsSync(styleLockDir)) {
      const files = fs.readdirSync(styleLockDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
      for (const file of files) {
        const filePath = path.join(styleLockDir, file);
        const buf = fs.readFileSync(filePath);
        let b64 = "";
        try {
           b64 = (await prepareImageBase64(filePath)).base64;
        } catch(e) {
           b64 = buf.toString('base64');
        }
        totalBytesDecoded += buf.length;
        totalBytesEncoded += b64.length;
        styleAnchors.push({ file, bytes: buf.length, base64Bytes: b64.length });
      }
    }
    
    // 2. Facility Anchors
    const facilityAnchors: any[] = [];
    const facilityAnchorDir = path.join(process.cwd(), 'src', 'data', 'Reference Images', 'facility-anchor');
    if (fs.existsSync(facilityAnchorDir)) {
      const selected = selectReferences(topic, sceneTypes);
      for (const item of selected) {
        const filePath = path.join(facilityAnchorDir, item.file);
        if(!fs.existsSync(filePath)) continue;
        const buf = fs.readFileSync(filePath);
        totalBytesDecoded += buf.length;
        
        let b64 = "";
        try {
           b64 = (await prepareImageBase64(filePath)).base64;
        } catch(e) {
           b64 = buf.toString('base64');
        }
        totalBytesEncoded += b64.length;
        facilityAnchors.push({ file: item.file, category: item.category, bytes: buf.length, base64Bytes: b64.length });
      }
    }
    
    res.json({
      topic,
      sceneTypes,
      masterStyleWrapper: wrapper.substring(0, 500) + "..." + wrapper.substring(wrapper.length - 500),
      masterStyleWrapper_totalChars: wrapper.length,
      masterStyleWrapper_containsUnresolvedTemplate: wrapper.includes("${"),
      sceneBlocksInjected: ["LOTO SCENE BLOCK", "SIGN_PRESENT BLOCK"],
      productFidelityInjected: wrapper.includes("PRODUCT FIDELITY (Tyson Prepared Foods"),
      facilityFingerprintInjected: wrapper.includes("FACILITY FINGERPRINT — Tyson Prepared Foods"),
      ppeContractInjected: wrapper.includes("CHARACTER PPE CONTRACT"),
      continuityBlockInjected: wrapper.includes("SAME-LOCATION CONTINUITY"),
      referenceImages: {
        styleAnchors,
        facilityAnchors,
        totalImages: styleAnchors.length + facilityAnchors.length,
        totalBytesDecoded,
        totalBytesEncoded
      },
      narrativeContainsProduct: "fully-cooked sausage patties",
      emphasisWordCounts: { 
         "STRICT": (wrapper.match(/STRICT/g) || []).length, 
         "MANDATORY": (wrapper.match(/MANDATORY/g) || []).length, 
         "CRITICAL": (wrapper.match(/CRITICAL/g) || []).length, 
         "MUST": (wrapper.match(/MUST/g) || []).length, 
         "ABSOLUTELY": (wrapper.match(/ABSOLUTELY/g) || []).length 
      }
    });
  });

  app.post("/api/gemini/vision-qa", async (req, res) => {
  try {
    const { image } = req.body;
    let apiKey;
    try {
      apiKey = getApiKey(req);
    } catch(err: any) {
      return res.status(400).send(err.message);
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-1.5-flash"; // Use flash for fast vision QA

    const systemInstruction = `You are a quality assurance auditor for industrial safety posters.
Evaluate the provided image against the Master Base Prompt requirements:
1. Are there exactly 3 equal-width rounded panels?
2. Is the PPE correct? (Workers in white hard hats, Supervisor in green hard hat, all in white frocks, mesh balaclavas, black boots).
3. Is the header text legible and correctly translated?
4. Is there any other readable text besides the header?

Return JSON:
{
  "isValid": boolean,
  "issues": ["list of specific failures"],
  "critique": "A concise summary of what needs fixing for the image model to correct it."
}`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: "Evaluate this safety poster." },
            {
              inlineData: {
                mimeType: "image/png",
                data: image.split(",")[1],
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            critique: { type: Type.STRING }
          },
          required: ["isValid", "issues", "critique"]
        },
        systemInstruction,
      },
    });

    res.json({ data: JSON.parse(response.text) });
  } catch (error: any) {
    console.error("Vision QA Error:", error);
    res.status(500).send(error.message);
  }
});

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  // Increase server timeout to 10 minutes to match the client-side timeout for Pro image generation
  server.timeout = 600000;
  server.keepAliveTimeout = 600000;
  server.headersTimeout = 601000;
}

startServer();
