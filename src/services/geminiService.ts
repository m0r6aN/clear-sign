import { GoogleGenAI, Type, Schema } from '@google/genai';

export interface ContractAnalysis {
  summary: string;
  redFlags: { description: string; severity: 'high' | 'medium' | 'low'; lineReference?: string }[];
  obligations: { description: string; party: string }[];
}

export async function analyzeContract(text: string): Promise<ContractAnalysis> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Analyze the following legal contract and extract the key details.\n\nContract Text:\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Plain English summary of the contract" },
          redFlags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
                lineReference: { type: Type.STRING }
              }
            }
          },
          obligations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                party: { type: Type.STRING }
              }
            }
          }
        },
        required: ["summary", "redFlags", "obligations"]
      } as Schema,
      systemInstruction: "You are an expert legal AI assistant. Your job is to translate dense legal text into plain English, highlight obligations, and flag potential risks for the user."
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate analysis.");
  }
  
  return JSON.parse(response.text) as ContractAnalysis;
}

export async function askContractQuestion(text: string, question: string, context: string[]): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const ai = new GoogleGenAI({ apiKey });
  
  let contents = `Contract Text:\n${text}\n\n`;
  if (context.length > 0) {
    contents += `Context Items Selected:\n${context.join('\n')}\n\n`;
  }
  contents += `User Question:\n${question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents,
    config: {
      systemInstruction: "You are a helpful legal assistant. Answer the user's question accurately based on the provided contract text and context. Be concise and write in plain English. Do not invent legal advice."
    }
  });
  
  return response.text || "I was unable to answer the question.";
}

export async function extractTextFromImage(dataUri: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = dataUri.split(',')[1];
  const mimeType = dataUri.split(';')[0].split(':')[1];
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      { inlineData: { data: base64Data, mimeType } },
      "Extract and return all the text from this document image exactly as it appears. Do not format or summarize it, just output raw text."
    ]
  });
  return response.text || '';
}
