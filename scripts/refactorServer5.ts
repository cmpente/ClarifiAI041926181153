import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace('handleGeminiError(error, res);', 'handleProxyError(res, error, "Random Topic");');

if (!content.includes('import crypto from "crypto";')) {
  content = content.replace('import path from "path";', 'import path from "path";\nimport crypto from "crypto";');
}

// Extract texts
const textGenMatch = content.match(/const systemInstruction = \`([\s\S]*?)\`;/);
if (textGenMatch) {
  content = content.replace(textGenMatch[0], 'const systemInstruction = getSystemInstruction();');
}

const imgGenMatch = content.match(/const masterStyleWrapper = \`([\s\S]*?)\`;/);
if (imgGenMatch) {
  content = content.replace(imgGenMatch[0], 'const masterStyleWrapper = getMasterStyleWrapper(prompt, environmentProfile);');
}

const headers = `
function getSystemInstruction() {
  return \`${textGenMatch ? textGenMatch[1].replace(/\`/g, '\\`') : ''}\`;
}

function getMasterStyleWrapper(prompt: string, environmentProfile: any) {
  return \`${imgGenMatch ? imgGenMatch[1].replace(/\`/g, '\\`').replace(/\$\{/g, '\\${') : ''}\`;
}
`;

content = content.replace('async function startServer() {', headers + '\nasync function startServer() {');

// Inject the debug endpoint
const debugEndpoint = `
  app.get("/api/debug/run-style-baseline", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: "Not found" });
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || req.header('x-goog-api-key');
    if (!apiKey) {
      res.write(\`data: \${JSON.stringify({ event: 'run-error', error: 'No API Key' })}\\n\\n\`);
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
      res.write(\`data: \${JSON.stringify({ event: 'run-error', error: 'Failed to read topics: ' + e.message })}\\n\\n\`);
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
      const pngPath = path.join(beforeDir, \`\${slug}.png\`);
      const txtPath = path.join(beforeDir, \`\${slug}.prompt.txt\`);
      
      if (!force && fs.existsSync(pngPath)) {
        res.write(\`data: \${JSON.stringify({ event: 'topic-skipped', slug, topic })}\\n\\n\`);
        continue;
      }
      
      try {
        const t0 = Date.now();
        // GENERATE TEXT
        let actualTopic = topic;
        try {
          const parsed = JSON.parse(topic);
          if (parsed.title) actualTopic = \`\${parsed.title}: \${parsed.hazard} -> \${parsed.intervention} -> \${parsed.safe_behavior}\`;
        } catch(e) {}

        const textParts = [...styleLockParts, { text: \`Analyze and creatively expand the following safety topic into a robust, highly-detailed structured JSON response. Strictly follow ALL system instructions, including the exact template for poster_prompt, PPE constraints (semi-transparent mesh balaclavas, NO aprons), and scenario constraints (End of shift prep ONLY for sanitation topics): \\n\\nSafety Topic: \${actualTopic}\` }];
        
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
        if (jsonStr.includes("\`\`\`json")) jsonStr = jsonStr.split("\`\`\`json")[1].split("\`\`\`")[0];
        else if (jsonStr.includes("\`\`\`")) jsonStr = jsonStr.split("\`\`\`")[1].split("\`\`\`")[0];
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
          imageFile: \`\${slug}.png\`,
          imageSize: imgFileBuf.length,
          imageHash: imgHash,
          promptFile: \`\${slug}.prompt.txt\`,
          promptSize: txtFileBuf.length,
          promptHash: txtHash,
          cost: topicCost,
          timeTextGenMs: t1 - t0,
          timeImageGenMs: t2 - t1,
          timeTotalMs: t2 - t0,
          modelText: textModelName,
          modelImage: imgModelName
        };

        res.write(\`data: \${JSON.stringify({ event: 'topic-complete', slug, topic, data: manifest[topic] })}\\n\\n\`);

      } catch (err: any) {
        res.write(\`data: \${JSON.stringify({ event: 'topic-error', slug, topic, error: err.message || err.toString() })}\\n\\n\`);
      }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    res.write(\`data: \${JSON.stringify({ event: 'run-complete', totalCost })}\\n\\n\`);
    res.end();
  });
`;

content = content.replace('app.post("/api/gemini/vision-qa"', debugEndpoint + '\n  app.post("/api/gemini/vision-qa"');

fs.writeFileSync('server.ts', content);
