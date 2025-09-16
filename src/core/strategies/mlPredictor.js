import { analyzeMarketWithAI } from '../aiMarketAnalysis';

/**
 * ML Predictor Strategy
 * This strategy uses an external AI (like Google Gemini) to analyze market conditions
 * and generate a trading signal based on the AI's sentiment and confidence.
 *
 * @param {object} ctx - The strategy context.
 * @param {object} ctx.marketData - Current market data.
 * @param {Array} ctx.historicalData - Historical k-line data.
 * @param {string} ctx.geminiAiApiKey - API key for Google Gemini.
 * @returns {Promise<object>} A signal object { signal, confidence, reason }.
 */
export async function mlPredictor(ctx) {
  const { marketData, historicalData, geminiAiApiKey } = ctx;

  if (!geminiAiApiKey) {
    return { signal: 'HOLD', confidence: 0, reason: 'Gemini AI API key not provided.' };
  }

  try {
    const aiAnalysisResult = await analyzeMarketWithAI(marketData.symbol, marketData, historicalData, geminiAiApiKey);

    if (!aiAnalysisResult.success || !aiAnalysisResult.analysis) {
      return { signal: 'HOLD', confidence: 0, reason: `AI analysis failed: ${aiAnalysisResult.error}` };
    }

    const { sentiment, confidence, reasoning } = aiAnalysisResult.analysis;
    const aiConfidence = (confidence || 0) / 100; // Convert from 0-100 to 0-1

    let signal = 'HOLD';
    if (sentiment === 'bullish') {
      signal = 'BUY';
    } else if (sentiment === 'bearish') {
      signal = 'SELL';
    }

    return {
      signal,
      confidence: aiConfidence,
      reason: `AI Reason: ${reasoning || 'No specific reason provided.'}`,
      meta: {
        aiSentiment: sentiment,
        aiConfidence: confidence,
      },
    };
  } catch (error) {
    console.error('Error in mlPredictor strategy:', error);
    return { signal: 'HOLD', confidence: 0, reason: `Exception during AI analysis: ${error.message}` };
  }
}
