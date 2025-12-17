import { GoogleGenAI } from "@google/genai";

// Initialize AI only if Key is present to prevent immediate crash on load
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Fallback phrases for offline mode or errors
const FALLBACK_COMMENTARY = [
  "Connection lost... attempt retry? Or are you scared, choom?",
  "System failure. Your skills registered as: MEDIOCRE.",
  "Network unreachable. Just like your dreams of winning.",
  "Signal jammed. But I saw that crash. Ouch.",
  "Offline Mode: You run like old hardware."
];

export const generateGameCommentary = async (score: number, durationSeconds: number): Promise<string> => {
  // 1. Safety Check: If no API key is found (e.g. internal testing / github clone)
  if (!ai) {
    console.warn("Gemini API Key missing. Running in Offline Mode.");
    return getRandomFallback();
  }

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
    // 2. Error Handling: Gracefully degrade if API fails (Quota limit / Network issue)
    console.error("Gemini API Error:", error);
    return getRandomFallback();
  }
};

const getRandomFallback = () => {
  const index = Math.floor(Math.random() * FALLBACK_COMMENTARY.length);
  return FALLBACK_COMMENTARY[index];
};
