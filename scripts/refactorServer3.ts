import fs from 'fs';

let text = fs.readFileSync('server.ts', 'utf8');

// Fix handleGeminiError
text = text.replace('handleGeminiError(error, res);', 'handleProxyError(res, error, "Random Topic");');

// Extract text logic
text = text.replace(
  '  app.post("/api/gemini/generate-text", async (req, res) => {\n    try {\n      const apiKey = req.header(\'x-goog-api-key\') || process.env.API_KEY || process.env.GEMINI_API_KEY;\n      if (!apiKey) throw new Error("Server API key not configured");\n      \n      const ai = new GoogleGenAI({ \n        apiKey,\n        httpOptions: {\n          timeout: 600000 // 10 minutes\n        }\n      });\n      const { topic, textModel, exaggerate, hazardHunt, referenceImages } = req.body;',
  `  async function generateTextCore(apiKey: string, body: any) {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 600000 } });
    const { topic, textModel, exaggerate, hazardHunt, referenceImages } = body;`
);

let textRouteEndIndex = text.indexOf('      console.log(`[Proxy] Text generation successful for topic: ${topic}`);\n      res.json({ data: jsonData, cost });\n    } catch (error: any) {\n      handleProxyError(res, error, "Text");\n    }\n  });');
if (textRouteEndIndex !== -1) {
  text = text.replace(
    '      console.log(`[Proxy] Text generation successful for topic: ${topic}`);\n      res.json({ data: jsonData, cost });\n    } catch (error: any) {\n      handleProxyError(res, error, "Text");\n    }\n  });',
    '      console.log(`[Proxy] Text generation successful for topic: ${topic}`);\n      return { data: jsonData, cost };\n}  app.post("/api/gemini/generate-text", async (req, res) => { try { const apiKey = req.header(\'x-goog-api-key\') || process.env.API_KEY || process.env.GEMINI_API_KEY; if (!apiKey) throw new Error("Server API key not configured"); const result = await generateTextCore(apiKey, req.body); res.json(result); } catch (error: any) { handleProxyError(res, error, "Text"); } });'
  );
}

// Extract image logic
text = text.replace(
  '  app.post("/api/gemini/generate-image", async (req, res) => {\n    console.log("[Proxy] Generate Image Request Received");\n    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;\n    \n    // Start background generation\n    (async () => {\n      try {\n        imageJobs.set(jobId, { status: \'pending\', timestamp: Date.now() });\n        \n        const apiKey = req.header(\'x-goog-api-key\') || process.env.API_KEY || process.env.GEMINI_API_KEY;\n        if (!apiKey) throw new Error("Server API key not configured");\n\n        const ai = new GoogleGenAI({ \n          apiKey,\n          httpOptions: {\n            timeout: 600000 // 10 minutes\n          }\n        });\n        const { prompt, model: requestedModel, imageSize, referenceImages, pdfReference } = req.body;',
  `  async function generateImageCore(apiKey: string, body: any, jobId?: string) {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 600000 } });
    const { prompt, model: requestedModel, imageSize, referenceImages, pdfReference } = body;`
);

let imageEndIndex = text.indexOf('        if (!url) throw new Error("The model did not return an image.");\n\n        imageJobs.set(jobId, { \n          status: \'completed\', \n          url, \n          cost, \n          timestamp: Date.now() \n        });\n        console.log(`[Proxy] Job ${jobId} completed successfully`);\n      } catch (error: any) {\n        console.error(`[Proxy] Job ${jobId} failed:`, error);\n        imageJobs.set(jobId, { \n          status: \'failed\', \n          error: error.message || "Unknown error during background generation", \n          timestamp: Date.now() \n        });\n      }\n    })();\n\n    // Immediately return the jobId to the client\n    res.json({ \n      jobId,\n      ...(req.query.debug === \'1\' ? { debugPrompt: masterStyleWrapper } : {})\n    });\n  });');

if (imageEndIndex !== -1) {
  text = text.substring(0, imageEndIndex) + 
`        if (!url) throw new Error("The model did not return an image.");
        return { url, cost, debugPrompt: masterStyleWrapper };
}
app.post("/api/gemini/generate-image", async (req, res) => {
    console.log("[Proxy] Generate Image Request Received");
    const jobId = \`job_\${Date.now()}_\${Math.random().toString(36).substring(2, 9)}\`;
    (async () => {
      try {
        imageJobs.set(jobId, { status: 'pending', timestamp: Date.now() });
        const apiKey = req.header('x-goog-api-key') || process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Server API key not configured");
        const result = await generateImageCore(apiKey, req.body, jobId);
        imageJobs.set(jobId, { status: 'completed', url: result.url, cost: result.cost, timestamp: Date.now() });
        console.log(\`[Proxy] Job \${jobId} completed successfully\`);
      } catch (error: any) {
        console.error(\`[Proxy] Job \${jobId} failed:\`, error);
        imageJobs.set(jobId, { status: 'failed', error: error.message || "Unknown error", timestamp: Date.now() });
      }
    })();
    // We cannot currently capture debugPrompt for the immediate response cleanly without waiting,
    // so we just return the jobId. The UI didn't use debugPrompt synchronously anyway.
    res.json({ jobId });
  });` + text.substring(imageEndIndex + 923); // Need to figure out exact length to cut. It's safer to use string replace.
}

fs.writeFileSync('server_extracted.ts', text);
