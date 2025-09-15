import { GoogleGenerativeAI } from '@google/generative-ai';

export async function getAiAnalysis(apiKey, coinSymbol) {
  if (!apiKey) {
    return "Google AI API Key not provided.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Provide a concise market analysis for the cryptocurrency ${coinSymbol}. Focus on current sentiment, recent significant news, and potential short-term risks or opportunities. Be objective and data-driven.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error fetching AI analysis:", error);
    return "Failed to get analysis from Google AI. Check the API key and console for details.";
  }
}
