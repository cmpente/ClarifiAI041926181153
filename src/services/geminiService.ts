/// <reference types="vite/client" />
import { SafetyPosterData, SafetyPosterSchema, GEMINI_TEXT_MODEL, GEMINI_EDIT_MODEL, VisionQAResult } from "../constants";

const MODEL_FAST = "gemini-2.5-flash-image";
const MODEL_PRO = "gemini-3-pro-image-preview";

export class GeminiService {
  private apiKey: string = "";

  constructor() {
    // We still load local key to pass to proxy if the user provided one manually
    const localKey = localStorage.getItem("GEMINI_API_KEY") || sessionStorage.getItem("GEMINI_API_KEY");
    if (localKey) {
      this.apiKey = localKey;
    } 
    else {
      const metaEnv = (import.meta as any).env;
      if (metaEnv?.VITE_GEMINI_API_KEY) {
        this.apiKey = metaEnv.VITE_GEMINI_API_KEY;
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
      // Prevent unhandled rejection if the original promise rejects after timeout
      promise.catch(() => {});
    }
  }

  async generatePosterDataWithCost(topic: string, textModel: string = GEMINI_TEXT_MODEL, exaggerate: boolean = false, hazardHunt: boolean = false, referenceImages?: string[], signal?: AbortSignal): Promise<{data: SafetyPosterData, cost: number}> {
    const timeoutMs = textModel.includes("pro") ? 300000 : 120000; // 5 mins for Pro, 2 mins for Flash
    const response = await this.withTimeout(
      this.callProxy('generate-text', { topic, textModel, exaggerate, hazardHunt, referenceImages }, signal),
      timeoutMs
    );
    return {
      data: SafetyPosterSchema.parse(response.data || response),
      cost: response.cost || 0
    };
  }

  async generateRandomTopic(signal?: AbortSignal): Promise<string> {
    const response = await this.withTimeout(
      this.callProxy('generate-random-topic', {}, signal),
      30000 
    );
    return response.topic;
  }

  async generatePosterData(topic: string, textModel: string = GEMINI_TEXT_MODEL, exaggerate: boolean = false, hazardHunt: boolean = false, referenceImages?: string[], signal?: AbortSignal): Promise<SafetyPosterData> {
    const res = await this.generatePosterDataWithCost(topic, textModel, exaggerate, hazardHunt, referenceImages, signal);
    return res.data;
  }

  async generateImageWithCost(prompt: string, model: string, imageSize: string = "1K", referenceImages?: string[], signal?: AbortSignal): Promise<{url: string, cost: number}> {
    const response = await this.callProxy('generate-image', { prompt, model, imageSize, referenceImages }, signal);
    
    if (response.jobId) {
      const jobId = response.jobId;
      console.log(`[GeminiService] Image generation started as job: ${jobId}`);
      
      // Polling loop
      const pollInterval = 3000; // 3 seconds
      const maxAttempts = 200; // 10 minutes total
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal?.aborted) throw new Error("Request cancelled");
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const statusResponse = await this.callProxy(`job-status/${jobId}`, {}, signal, 'GET');
        
        if (statusResponse.status === 'completed') {
          return {
            url: statusResponse.url,
            cost: statusResponse.cost || 0
          };
        } else if (statusResponse.status === 'failed') {
          throw new Error(statusResponse.error || "Image generation failed in background");
        }
        
        // Still pending, continue polling
        console.log(`[GeminiService] Job ${jobId} still pending (attempt ${attempt + 1})...`);
      }
      
      throw new Error("Image generation timed out after 10 minutes");
    }

    return {
      url: response.url,
      cost: response.cost || 0
    };
  }

  async generateImage(prompt: string, model: string, imageSize: string = "1K", referenceImages?: string[], signal?: AbortSignal): Promise<string> {
    const res = await this.generateImageWithCost(prompt, model, imageSize, referenceImages, signal);
    return res.url;
  }

  async editImage(base64Image: string, prompt: string, signal?: AbortSignal): Promise<string> {
    const response = await this.withTimeout(
      this.callProxy('edit-image', { image: base64Image, prompt }, signal),
      60000
    );
    return response.url;
  }

  async visionQA(imageUrl: string, signal?: AbortSignal): Promise<VisionQAResult> {
    const response = await this.withTimeout(
      this.callProxy('vision-qa', { image: imageUrl }, signal),
      60000
    );
    return response.data;
  }

  private async callProxy(endpoint: string, body: any, signal?: AbortSignal, method: string = 'POST') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['x-goog-api-key'] = this.apiKey;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    
    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(body);
    }
    
    if (signal) {
      fetchOptions.signal = signal;
    }

    try {
      const response = await fetch(`/api/gemini/${endpoint}`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy Error: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        const text = await response.text();
        console.error(`[GeminiService] Expected JSON but got ${contentType} from ${endpoint}`);
        // If we got HTML (likely index.html from Vite fallback), it means the API route wasn't hit
        if (text.includes("<!doctype html") || text.includes("<!DOCTYPE html")) {
          throw new Error(`Server Configuration Error: API endpoint '/api/gemini/${endpoint}' not found (404). The server may not be running correctly.`);
        }
        throw new Error(`Invalid response format: ${text.substring(0, 100)}...`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error("Request cancelled");
      }
      throw error;
    }
  }
}
