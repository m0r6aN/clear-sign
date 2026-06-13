import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generate() {
  console.log('Generating logo...');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'A modern, minimalist, and unique app icon for a tech startup named ClearSign. The app uses AI to analyze legal contracts. The logo should feel empowering, trustworthy, and cutting-edge. Abstract geometric shapes, subtly combining a document with a spark or eye representing AI clarity. Deep blue and vibrant cyan colors. Clean solid dark background. No text.',
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        fs.mkdirSync('public', { recursive: true });
        fs.writeFileSync('public/logo.png', buffer);
        fs.writeFileSync('public/favicon.png', buffer);
        console.log('Logo saved to public/logo.png and public/favicon.png');
        break;
      }
    }
  } catch (error) {
    console.error('Error generating image:', error);
  }
}

generate();
