import { SentimentResult } from "../types";

export async function analyzeSentiment(symbol: string, news: string[]): Promise<SentimentResult> {
  try {
    const response = await fetch("/api/gemini/sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, news }),
    });
    if (!response.ok) throw new Error("Sentiment API failed");
    return response.json();
  } catch (error) {
    console.error("Sentiment analysis failed:", error);
    return { sentiment: "neutral", score: 0.5, summary: "Could not analyze news sentiment at this time." };
  }
}

export async function getPerformancePrediction(symbol: string, history: any[]): Promise<any> {
  try {
    const response = await fetch("/api/gemini/prediction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, history }),
    });
    if (!response.ok) throw new Error("Prediction API failed");
    return response.json();
  } catch (error) {
    return { "1D": "Neutral", "1W": "Neutral", "1M": "Neutral" };
  }
}
