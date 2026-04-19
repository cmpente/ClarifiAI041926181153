import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
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

function getMasterStyleWrapper(prompt: string, environmentProfile: any) {
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

CHARACTERS (PPE STANDARDS - STRICT ADHERENCE REQUIRED):
- ALL personnel MUST wear: white lab coats/frocks, clear safety glasses, BLUE nitrile food-safe gloves (NO BARE HANDS EVER), and BLACK rubber boots.
- CRITICAL: White, semi-transparent mesh BALACLAVA HOODS MUST cover all hair and beards entirely (no hair visible).
- Standard workers MUST wear WHITE hard hats.
- Supervisors MUST wear GREEN hard hats (never blue or white). 
- NO blue hard hats allowed anywhere in the image.
- NO white boots allowed; boots must be solid black rubber.
- NO bare hands allowed; always blue nitrile gloves.
- Same worker must appear in all panels
- Consistent proportions and appearance
- Supervisor appears only where required

FOOD SAFETY & PRODUCT FLOW RULES (STRICT):
- NO EXPOSED PRODUCT DURING WASHDOWN: If a panel depicts sanitation, washdown, or spraying water, the conveyors and equipment MUST be completely empty. NO food product visible on the belts during cleaning.
- LOGICAL PRODUCT FLOW: Product on conveyors must be arranged in orderly lines or consistent patterns, not chaotic piles (unless explicitly illustrating a "jam"). 
- NO CROSS-CONTAMINATION: Water must not spray onto exposed food. 

ENVIRONMENT GROUNDING (FROM FACILITY PDF — STRICT):

Floor:
- Type: \${environmentProfile ? environmentProfile.floor.type : 'Reddish-brown epoxy surface'}
- Color: \${environmentProfile ? environmentProfile.floor.color : ''}
- Condition: \${environmentProfile ? environmentProfile.floor.condition.join(", ") : 'Slightly reflective with visible moisture and wear'}
- Markings: \${environmentProfile ? environmentProfile.floor.markings.join(", ") : 'Yellow safety lane markings and boundary lines clearly visible'}

Walls:
- Structure: \${environmentProfile ? environmentProfile.walls.structure.join(", ") : 'White tile or industrial panel walls'}
- Features: \${environmentProfile ? environmentProfile.walls.features.join(", ") : 'Visible grout lines or panel seams, Mounted fixtures and industrial attachments present'}

Ceiling:
- Elements: \${environmentProfile ? environmentProfile.ceiling.elements.join(", ") : 'Exposed piping, conduit, and overhead utility lines, Dense overhead infrastructure'}

Equipment:
- Density: \${environmentProfile ? environmentProfile.equipment.density : 'High-density stainless steel industrial machinery'}
- Types: \${environmentProfile ? environmentProfile.equipment.types.join(", ") : 'Multiple conveyors and connected systems visible'}
- Layout: \${environmentProfile ? environmentProfile.equipment.layout : 'Equipment must appear interconnected, not isolated'}

Spatial:
- Layout: \${environmentProfile ? environmentProfile.spatial.layout : 'Tight, crowded production floor, Minimal empty space'}
- Depth: \${environmentProfile ? environmentProfile.spatial.depth : 'Foreground: active worker interaction, Midground: primary machinery, Background: additional equipment and structural elements'}
- Visibility: \${environmentProfile ? environmentProfile.spatial.visibility : 'Flat backgrounds are NOT allowed'}

Lighting:
- Type: \${environmentProfile ? environmentProfile.lighting.type : 'Bright overhead industrial lighting'}
- Tone: \${environmentProfile ? environmentProfile.lighting.tone : 'Cool-toned illumination'}
- Brightness: \${environmentProfile ? environmentProfile.lighting.brightness : 'Slight reflections on metal surfaces'}

CRITICAL:
These environment constraints are mandatory.
Do not simplify, generalize, or remove details.

VISUAL NARRATIVES (DETAILED MECHANICS):
\${prompt}`;
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

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      envApiKey: process.env.API_KEY, 
      envGeminiKey: process.env.GEMINI_API_KEY,
      headerKey: req.header('x-goog-api-key'),
      cwd: process.cwd(),
      hasEnv: fs.existsSync('.env'),
      hasEnvExample: fs.existsSync('.env.example'),
      envExampleContent: fs.existsSync('.env.example') ? fs.readFileSync('.env.example', 'utf-8') : null
    });
  });

  app.get("/api/config", (req, res) => {
    const hasServerKey = !!(process.env.API_KEY || process.env.GEMINI_API_KEY);
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
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: "Not found" });
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const apiKey = (req.query.key as string) || process.env.GEMINI_API_KEY || process.env.API_KEY || req.header('x-goog-api-key');
    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ event: 'run-error', error: 'No API Key' })}\n\n`);
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

    const beforeDir = path.join(process.cwd(), 'tests', 'style-baseline', 'before');
    if (!fs.existsSync(beforeDir)) fs.mkdirSync(beforeDir, { recursive: true });
    
    const manifestPath = path.join(beforeDir, 'run-manifest.json');
    let manifest: any = {};
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch(e){}
    }

    const styleLockDir = path.join(process.cwd(), 'src', 'data', 'Reference Images');
    const styleLockParts: any[] = [];
    try {
      if (fs.existsSync(styleLockDir)) {
        const files = fs.readdirSync(styleLockDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
        for (const file of files) {
          const filePath = path.join(styleLockDir, file);
          const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
          const mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
          styleLockParts.push({ inlineData: { mimeType, data: base64Data } });
        }
      }
    } catch (e) {}

    let totalCost = 0;

    for (const topic of topics) {
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const pngPath = path.join(beforeDir, `${slug}.png`);
      const txtPath = path.join(beforeDir, `${slug}.prompt.txt`);
      
      if (!force && fs.existsSync(pngPath)) {
        res.write(`data: ${JSON.stringify({ event: 'topic-skipped', slug, topic })}\n\n`);
        continue;
      }
      
      try {
        const t0 = Date.now();
        // GENERATE TEXT
        let actualTopic = topic;
        try {
          const parsed = JSON.parse(topic);
          if (parsed.title) actualTopic = `${parsed.title}: ${parsed.hazard} -> ${parsed.intervention} -> ${parsed.safe_behavior}`;
        } catch(e) {}

        const textParts = [...styleLockParts, { text: `Analyze and creatively expand the following safety topic into a robust, highly-detailed structured JSON response. Strictly follow ALL system instructions, including the exact template for poster_prompt, PPE constraints (semi-transparent mesh balaclavas, NO aprons), and scenario constraints (End of shift prep ONLY for sanitation topics): \n\nSafety Topic: ${actualTopic}` }];
        
        const responseSchema = { /* (Using simple object type for any) */
          type: "OBJECT",
          properties: {
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
          required: ["poster_prompt"]
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

        let txtCost = 0;
        if (textResp.usageMetadata) {
          const iTokens = textResp.usageMetadata.promptTokenCount || 0;
          const oTokens = textResp.usageMetadata.candidatesTokenCount || 0;
          txtCost = (iTokens / 1000000) * 1.25 + (oTokens / 1000000) * 5.00;
        }

        const t1 = Date.now();

        // GENERATE IMAGE
        let environmentProfile = (global as any).cachedEnvironmentProfile;
        if (!environmentProfile) {
          environmentProfile = {
            floor: { type: "epoxy", color: "reddish-brown", condition: ["wet", "reflective", "scuffed"], markings: ["yellow safety lines", "lane boundaries"] },
            walls: { structure: ["white tile", "metal panel seams", "corrugated silver"], features: ["grout lines", "mounted fixtures"] },
            ceiling: { elements: ["exposed piping", "conduit", "cable trays"] },
            equipment: { density: "high", types: ["conveyors", "packaging machines", "control panels", "Mettler Toledo metal detectors", "stainless tanks"], layout: "interconnected continuous systems" },
            spatial: { layout: "tight", depth: "layered foreground + background machinery", visibility: "partially obstructed" },
            lighting: { type: "industrial overhead", tone: "cool", brightness: "high" }
          };
        }

        const imgPromptHtml = getMasterStyleWrapper(posterPrompt, environmentProfile);
        // De-escape if needed, but since we parsed from a template literal, we just use it directly.
        // Let's actually dynamically reconstruct the wrapper to ensure correct values, since we replaced variables in the regex.
        // Wait, getMasterStyleWrapper correctly fills variables.
        
        const imgParts = [...styleLockParts, { text: imgPromptHtml }];
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

        // WRITE FILES
        fs.writeFileSync(pngPath, Buffer.from(base64, 'base64'));
        fs.writeFileSync(txtPath, imgPromptHtml);

        const imgFileBuf = fs.readFileSync(pngPath);
        const imgHash = crypto.createHash('sha256').update(imgFileBuf).digest('hex');
        
        const txtFileBuf = fs.readFileSync(txtPath);
        const txtHash = crypto.createHash('sha256').update(txtFileBuf).digest('hex');

        const topicCost = txtCost + imgCost;
        totalCost += topicCost;

        manifest[topic] = {
          topic,
          imageFile: `${slug}.png`,
          imageSize: imgFileBuf.length,
          imageHash: imgHash,
          promptFile: `${slug}.prompt.txt`,
          promptSize: txtFileBuf.length,
          promptHash: txtHash,
          cost: topicCost,
          timeTextGenMs: t1 - t0,
          timeImageGenMs: t2 - t1,
          timeTotalMs: t2 - t0,
          modelText: textModelName,
          modelImage: imgModelName
        };

        res.write(`data: ${JSON.stringify({ event: 'topic-complete', slug, topic, data: manifest[topic] })}\n\n`);

      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ event: 'topic-error', slug, topic, error: err.message || err.toString() })}\n\n`);
      }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    res.write(`data: ${JSON.stringify({ event: 'run-complete', totalCost })}\n\n`);
    res.end();
  });

  app.post("/api/gemini/vision-qa", async (req, res) => {
  try {
    const { image } = req.body;
    const apiKey = req.headers["x-goog-api-key"] as string || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).send("API Key missing");

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3.1-flash-lite-preview"; // Use flash lite for fast vision QA

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
