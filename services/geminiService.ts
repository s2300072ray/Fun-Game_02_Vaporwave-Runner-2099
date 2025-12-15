import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateGameCommentary = async (score: number, durationSeconds: number): Promise<string> => {
  try {
    const prompt = `
      You are a cynical, cyberpunk arcade machine AI. A player just finished a run in the game "Neon Runner".
      Stats:
      - Score: ${Math.floor(score)}
      - Duration: ${durationSeconds.toFixed(1)} seconds.
      
      If the score is low (< 500), roast them gently but encourage them to retry.
      If the score is medium (500-1500), give them a backhanded compliment.
      If the score is high (> 1500), praise them as a "Netrunner Legend" but warn them about the singularity.
      
      Keep it short (max 2 sentences). Use slang like "choom", "glitch", "chrome", "flatline".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "System Reboot...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Neural Link Interrupted.";
  }
};
