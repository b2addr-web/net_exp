import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ── Stock Data (Polygon.io) ───────────────────────────────────────────────
  app.get("/api/stock/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const apiKey = process.env.POLYGON_API_KEY;

    if (!apiKey || apiKey === "YOUR_POLYGON_API_KEY") {
      return res.status(401).json({
        error: "Missing Polygon API Key",
        message: "Please add your POLYGON_API_KEY to the environment variables.",
      });
    }

    try {
      const tickerSymbol = symbol.toUpperCase();

      // Current price snapshot
      const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${tickerSymbol}?apiKey=${apiKey}`;
      const snapshotRes = await fetch(snapshotUrl);
      const snapshotData = await snapshotRes.json();

      if (snapshotData.status === "ERROR") {
        return res.status(400).json({ error: "API Error", message: snapshotData.error || "Invalid request to Polygon API" });
      }

      if (!snapshotData.ticker) {
        return res.status(404).json({ error: "Ticker not found", message: `The symbol ${tickerSymbol} was not found.` });
      }

      const ticker = snapshotData.ticker;
      const currentPrice = ticker.lastTrade?.p || ticker.day?.c || ticker.prevDay?.c || 0;
      const prevClose = ticker.prevDay?.c || currentPrice;
      const change = ticker.todaysChange || currentPrice - prevClose;
      const changePercent = ticker.todaysChangePerc || (prevClose !== 0 ? (change / prevClose) * 100 : 0);

      // Historical data (last 30 days)
      const to = new Date().toISOString().split("T")[0];
      const from = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const aggUrl = `https://api.polygon.io/v2/aggs/ticker/${tickerSymbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=30&apiKey=${apiKey}`;
      const aggRes = await fetch(aggUrl);
      const aggData = await aggRes.json();

      const history = (aggData.results || []).map((r: any) => ({
        date: new Date(r.t).toISOString().split("T")[0],
        price: Number(r.c.toFixed(2)),
      }));

      if (history.length === 0 && currentPrice !== 0) {
        history.push({ date: new Date().toISOString().split("T")[0], price: Number(currentPrice.toFixed(2)) });
      }

      res.json({
        symbol: tickerSymbol,
        price: currentPrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
        fundamentals: { peRatio: "N/A", eps: "N/A", revenueGrowth: "N/A" },
        history,
      });
    } catch (error: any) {
      console.error("Polygon API Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  });

  // ── Gemini: Sentiment ─────────────────────────────────────────────────────
  app.post("/api/gemini/sentiment", async (req, res) => {
    const { symbol, news } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return res.json({ sentiment: "neutral", score: 0.5, summary: "Gemini API key not configured." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `Analyze the sentiment for the stock ${symbol} based on these news headlines:
${news.join("\n")}

Return a JSON object with:
- sentiment: "positive", "negative", or "neutral"
- score: a number from 0 to 1
- summary: a brief 1-sentence summary of the news impact.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Gemini sentiment error:", error);
      res.json({ sentiment: "neutral", score: 0.5, summary: "Could not analyze sentiment." });
    }
  });

  // ── Gemini: Prediction ────────────────────────────────────────────────────
  app.post("/api/gemini/prediction", async (req, res) => {
    const { symbol, history } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return res.json({ "1D": "Neutral", "1W": "Neutral", "1M": "Neutral" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `Based on the following 30-day price history for ${symbol}, predict the trend for 1 Day, 1 Week, and 1 Month.
History: ${JSON.stringify(history.slice(-10))}

Return a JSON object with exactly these keys and values only Bullish, Bearish, or Neutral:
{ "1D": "...", "1W": "...", "1M": "..." }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Gemini prediction error:", error);
      res.json({ "1D": "Neutral", "1W": "Neutral", "1M": "Neutral" });
    }
  });

  // ── Vite / Static ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

startServer();
