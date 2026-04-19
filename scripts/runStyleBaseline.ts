import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const TOPICS_FILE = path.join(process.cwd(), 'tests', 'style-baseline', 'test-topics.json');
const BEFORE_DIR = path.join(process.cwd(), 'tests', 'style-baseline', 'before');
const GOLDEN_DIR = path.join(process.cwd(), 'tests', 'style-baseline', 'golden');
const MANIFEST_FILE = path.join(BEFORE_DIR, 'run-manifest.json');
const BASE_URL = 'http://127.0.0.1:3000';

// Check for args
const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');

// Environment variables fallback to .env.local natively loaded by user shell
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

type ManifestEntry = {
  topic: string;
  imageFile: string;
  imageSize: number;
  imageHash: string;
  promptFile: string;
  promptSize: number;
  promptHash: string;
  cost: number;
  timeTextGenMs: number;
  timeImageGenMs: number;
  timeTotalMs: number;
  modelText: string;
  modelImage: string;
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function preflight() {
  console.log("=== Running Preflight Checks ===");
  
  // 1. Check API Key
  if (!API_KEY) {
    console.error("❌ PREFLIGHT FAILED: No API key found. Please define GEMINI_API_KEY or API_KEY in your .env.local or environment.");
    process.exit(1);
  } else {
    console.log("✅ API Key found in environment.");
  }

  // 2. Check Dev Server
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!healthRes.ok) throw new Error(`Status ${healthRes.status}`);
    console.log("✅ Dev server is running and reachable.");
  } catch(e) {
    console.error("❌ PREFLIGHT FAILED: Dev server not reachable at http://localhost:3000/api/health.");
    console.error("   Please ensure you have run `npm run dev` in a separate terminal.");
    process.exit(1);
  }

  // 3. Check Golden Dir
  if (!fs.existsSync(GOLDEN_DIR) || fs.readdirSync(GOLDEN_DIR).length === 0) {
    console.error("❌ PREFLIGHT FAILED: Golden directory rests empty. It must contain at least one reference file.");
    process.exit(1);
  } else {
    console.log(`✅ Golden directory contains ${fs.readdirSync(GOLDEN_DIR).length} file(s).`);
  }

  console.log("Preflight complete.\n");
}

async function run() {
  await preflight();

  if (isDryRun) {
    console.log("=== DRY RUN MODE ===");
    console.log(`Topics File: ${TOPICS_FILE}`);
    console.log(`Output Dir: ${BEFORE_DIR}`);
    console.log(`Server URL: ${BASE_URL}`);
    console.log("Exiting without making API calls.");
    process.exit(0);
  }

  fs.mkdirSync(BEFORE_DIR, { recursive: true });
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));

  let totalCost = 0;
  const manifest: Record<string, ManifestEntry> = {};

  for (const topic of topics) {
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const destImage = path.join(BEFORE_DIR, `${slug}.png`);
    const destPrompt = path.join(BEFORE_DIR, `${slug}.prompt.txt`);

    console.log(`\n=== Processing: ${topic} ===`);

    if (fs.existsSync(destImage) && !isForce) {
      console.log(`⏭️  Output ${slug}.png already exists. Skipping. Provide --force to overwrite.`);
      continue;
    }

    try {
      const topicStartTime = Date.now();
      
      // 1. Generate text
      console.log('Generating text (expanding narrative)...');
      const textStartTime = Date.now();
      const textRes = await fetch(`${BASE_URL}/api/gemini/generate-text`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY 
        },
        body: JSON.stringify({ topic, textModel: 'gemini-3.1-pro-preview' })
      });

      if (!textRes.ok) {
        throw new Error(`Text generation failed: ${await textRes.text()}`);
      }

      const textData = await textRes.json();
      const posterPrompt = textData.data?.poster_prompt;
      const textCost = textData.cost || 0;
      const timeTextGenMs = Date.now() - textStartTime;
      
      if (!posterPrompt) {
        throw new Error('No poster_prompt returned from text generation.');
      }

      // 2. Generate image
      console.log('Generating image (dispatching job)...');
      const imageStartTime = Date.now();
      const imageRes = await fetch(`${BASE_URL}/api/gemini/generate-image?debug=1`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY 
        },
        body: JSON.stringify({ prompt: posterPrompt, model: 'gemini-3-pro-image-preview', imageSize: '1K' })
      });

      if (!imageRes.ok) {
        throw new Error(`Image generation failed: ${await imageRes.text()}`);
      }

      const imageData = await imageRes.json();
      const jobId = imageData.jobId;
      const debugPrompt = imageData.debugPrompt;

      if (debugPrompt) {
        fs.writeFileSync(destPrompt, debugPrompt);
      } else {
        console.warn('WARNING: debugPrompt was not returned by the server!');
        fs.writeFileSync(destPrompt, posterPrompt); // Fallback
      }

      // 3. Poll for job completion
      console.log(`Polling job ${jobId}...`);
      let imgBase64 = null;
      let imgCost = 0;
      
      while (true) {
        const statusRes = await fetch(`${BASE_URL}/api/gemini/job-status/${jobId}`);
        if (!statusRes.ok) throw new Error(`Status check failed: ${await statusRes.text()}`);
        
        const statusData = await statusRes.json();
        
        if (statusData.status === 'completed') {
          console.log(`Job ${jobId} completed!`);
          imgCost = statusData.cost || 0;
          const url = statusData.url;
          try {
            imgBase64 = url.split(',')[1];
          } catch(e) {
             console.error('Invalid URL format received.');
          }
          break;
        } else if (statusData.status === 'failed') {
          throw new Error(`Job failed: ${statusData.error}`);
        } else {
          // pending
          await delay(2000);
        }
      }

      const timeImageGenMs = Date.now() - imageStartTime;

      if (imgBase64) {
        fs.writeFileSync(destImage, Buffer.from(imgBase64, 'base64'));
        console.log(`✅ Saved ${slug}.png`);
      }

      const timeTotalMs = Date.now() - topicStartTime;
      const combinedCost = textCost + imgCost;
      totalCost += combinedCost;

      // Log into manifest
      manifest[topic] = {
        topic,
        imageFile: `${slug}.png`,
        imageSize: fs.statSync(destImage).size,
        imageHash: getSha256(destImage),
        promptFile: `${slug}.prompt.txt`,
        promptSize: fs.statSync(destPrompt).size,
        promptHash: getSha256(destPrompt),
        cost: combinedCost,
        timeTextGenMs,
        timeImageGenMs,
        timeTotalMs,
        modelText: 'gemini-3.1-pro-preview',
        modelImage: 'gemini-3-pro-image-preview',
      };

    } catch (e) {
      console.error(`Error processing ${topic}:`, e);
    }
  }

  // 4. Wrap up
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`\n=== RUN COMPLETE ===`);
  console.log(`Total expected cost: $${totalCost.toFixed(4)}`);
  console.log(`Manifest written to: ${MANIFEST_FILE}`);
}

run().catch(console.error);
