import { Type } from "@google/genai";

export interface EnvironmentProfile {
  floor: {
    type: string;
    color: string;
    condition: string[];
    markings: string[];
  };
  walls: {
    structure: string[];
    features: string[];
  };
  ceiling: {
    elements: string[];
  };
  equipment: {
    density: string;
    types: string[];
    layout: string;
  };
  spatial: {
    layout: string;
    depth: string;
    visibility: string;
  };
  lighting: {
    type: string;
    tone: string;
    brightness: string;
  };
}

export async function extractImagesFromPDF(pdfBuffer: string | any[]): Promise<any[]> {
  if (Array.isArray(pdfBuffer)) return pdfBuffer;
  return [pdfBuffer];
}

export async function analyzeFacilityEnvironment(images: any[], ai: any): Promise<EnvironmentProfile> {
  const systemInstruction = `You are a strict facility environment analyst. 
ONLY describe physical environment geometry + objects.
DO NOT describe style.
DO NOT infer emotions or abstract concepts.
Must be consistent across multiple images.
Must normalize vocabulary (no variation like "factory-ish", "industrial feel").
Only return the JSON response requested.`;

  const imageParts: any[] = [];
  for (const img of images) {
    if (typeof img === 'string') {
      const matches = img.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        imageParts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }
  }

  // If no valid images were parsed, throw an error
  if (imageParts.length === 0) {
    throw new Error("No valid images found to analyze.");
  }

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      floor: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          color: { type: Type.STRING },
          condition: { type: Type.ARRAY, items: { type: Type.STRING } },
          markings: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["type", "color", "condition", "markings"]
      },
      walls: {
        type: Type.OBJECT,
        properties: {
          structure: { type: Type.ARRAY, items: { type: Type.STRING } },
          features: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["structure", "features"]
      },
      ceiling: {
        type: Type.OBJECT,
        properties: {
          elements: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["elements"]
      },
      equipment: {
        type: Type.OBJECT,
        properties: {
          density: { type: Type.STRING },
          types: { type: Type.ARRAY, items: { type: Type.STRING } },
          layout: { type: Type.STRING }
        },
        required: ["density", "types", "layout"]
      },
      spatial: {
        type: Type.OBJECT,
        properties: {
          layout: { type: Type.STRING },
          depth: { type: Type.STRING },
          visibility: { type: Type.STRING }
        },
        required: ["layout", "depth", "visibility"]
      },
      lighting: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          tone: { type: Type.STRING },
          brightness: { type: Type.STRING }
        },
        required: ["type", "tone", "brightness"]
      }
    },
    required: ["floor", "walls", "ceiling", "equipment", "spatial", "lighting"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [
        ...imageParts,
        { text: "Analyze these facility images and return the structured environment profile." }
    ],
    config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
    }
  });

  if (!response.text) { 
    throw new Error("Vision model returned empty environment JSON."); 
  }
  
  return JSON.parse(response.text) as EnvironmentProfile;
}

export async function processEnvironmentFromPDF(pdfBuffer: string | any[], ai: any): Promise<EnvironmentProfile> {
  const images = await extractImagesFromPDF(pdfBuffer);
  return await analyzeFacilityEnvironment(images, ai);
}

export function validateEnvironmentInjection(profile: EnvironmentProfile | null): void {
  if (!profile) throw new Error("Validation Failed: Environment Profile is null when PDF is provided.");
  if (!profile.floor || !profile.floor.type) throw new Error("Validation Failed: Missing floor data.");
  if (!profile.equipment || !profile.equipment.types || profile.equipment.types.length === 0) throw new Error("Validation Failed: Missing equipment types.");
  if (!profile.spatial || !profile.spatial.layout || profile.spatial.layout === "generic") {
    throw new Error("Validation Failed: Spatial layout is generic or undefined.");
  }
}


