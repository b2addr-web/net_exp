import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Search,
  Activity,
  BarChart3,
  Newspaper,
  Target,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { fetchStockData, calculateTradeSetup } from "./services/stockService";
import { analyzeSentiment, getPerformancePrediction } from "./services/geminiService";
import { StockData, TradeSetup, SentimentResult } from "./types";

export default function App() {
  const [symbol, setSymbol]           = useState("AAPL");
  const [searchInput, setSearchInput] = useState("");
  const [data, setData]               = useState<StockData | null>(null);
  const [setup, setSetup]             = useState<TradeSetup | null>(null);
  const [sentiment, setSentiment]     = useState<SentimentResult | null>(null);
  const [prediction, setPrediction]   = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; reason: string }>({
    isOpen: false,
    reason: "Checking...",
  });

  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        weekday: "long",
      }).formatToParts(now);

      const day    = parts.find(p => p.type === "weekday")?.value;
      const hour   = parseInt(parts.find(p => p.type === "hour")?.value   || "0");
      const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");

      const isWeekend    = day === "Saturday" || day === "Sunday";
      const totalMinutes = hour * 60 + minute;
      const openMinutes  = 9 * 60 + 30;
      const closeMinutes = 16 * 60;

      if (isWeekend) {
        setMarketStatus({ isOpen: false, reason: "Market Closed (Weekend)" });
      } else if (totalMinutes < openMinutes || totalMinutes >= closeMinutes) {
        setMarketStatus({ isOpen: false, reason: "Market Closed (After Hours)" });
      } else {
        setMarketStatus({ isOpen: true, reason: "Market Open" });
      }
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (targetSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const stockData = await fetchStockData(targetSymbol);

      if ((stockData as any).error === "Missing Polygon API Key") {
        setError((stockData as any).message);
        setLoading(false);
        return;
      }

      setData(stockData);
      setSetup(calculateTradeSetup(Number(stockData.price)));

      const mockNews = [
        `${targetSymbol} market activity remains high`,
        `Recent trends show strong interest in ${targetSymbol}`,
        `Analysts monitoring ${targetSymbol} for upcoming shifts`,
      ];

      const [sentimentRes, predictionRes] = await Promise.all([
        analyzeSentiment(targetSymbol, mockNews),
        getPerformancePrediction(targetSymbol, stockData.history),
      ]);

      setSentiment(sentimentRes);
      setPrediction(predictionRes);
    } catch (err: any) {
      setError(err.message || "Failed to load stock data. Please check your API keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(symbol);
  }, [symbol]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSymbol(searchInput.toUpperCase());
      setSearchInput("");
    }
  };

  // ── FIX: correct confidence calculation ──────────────────────────────────
  const confidencePercent = ((sentiment?.score || 0) * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-gray-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              US Stock Analyzer
            </h1>
          </div>

          <form onSubmit={handleSearch} className="relative w-full max-w-md mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search Symbol (e.g. NVDA, TSLA)..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </form>

          <div className="hidden md:flex items-center gap-4 text-xs font-medium text-gray-400">
            <span className="flex items-center gap-1">
              <span className={cn("w-2 h-2 rounded-full", marketStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
              {marketStatus.reason}
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-emerald-500/80 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Live Data Feed
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg">Setup Required: Missing API Key</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              To get real-time stock prices, add your <strong>Polygon.io</strong> API key to your environment variables.
              Get a free key in under a minute.
            </p>
            <ol className="list-decimal list-inside text-xs text-gray-400 space-y-2 mb-6">
              <li>Visit <a href="https://polygon.io/" target="_blank" className="text-emerald-400 underline">Polygon.io</a> and register for a free key.</li>
              <li>Add <code>POLYGON_API_KEY</code> to your environment variables (Render / Vercel / .env).</li>
              <li>Restart the server.</li>
            </ol>
            <button
              onClick={() => loadData(symbol)}
              className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stock Hero */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <BarChart3 className="w-32 h-32" />
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-4xl font-bold tracking-tighter">{data?.symbol || symbol}</h2>
                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono text-gray-400">NASDAQ</span>
                  </div>
                  <p className="text-gray-400 text-sm">Real-time Trading View</p>
                </div>

                <div className="text-right">
                  <div className="text-5xl font-mono font-bold tracking-tighter">
                    ${data?.price ?? "—"}
                  </div>
                  <div className={cn(
                    "flex items-center justify-end gap-1 font-medium",
                    Number(data?.change) >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {Number(data?.change) >= 0
                      ? <ArrowUpRight className="w-4 h-4" />
                      : <ArrowDownRight className="w-4 h-4" />}
                    {data?.change} ({data?.changePercent}%)
                  </div>
                </div>
              </div>

              <div className="h-[350px] mt-8 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.history}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#4b5563"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={val => val.split("-").slice(1).join("/")}
                    />
                    <YAxis
                      stroke="#4b5563"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                      tickFormatter={val => `$${val}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
                      itemStyle={{ color: "#10b981" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorPrice)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Trade Setup + Fundamentals */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold">Trade Setup (AI Recommended)</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Entry Price",            val: setup?.entry,  color: "text-emerald-400" },
                    { label: "Take Profit 1 (Target)", val: setup?.tp1,    color: "text-blue-400"    },
                    { label: "Take Profit 2 (Extended)",val: setup?.tp2,   color: "text-purple-400"  },
                    { label: "Stop Loss",              val: setup?.sl,     color: "text-rose-400", rose: true },
                  ].map(({ label, val, color, rose }) => (
                    <div key={label} className={cn(
                      "flex justify-between items-center p-3 rounded-xl border",
                      rose ? "bg-rose-500/5 border-rose-500/20" : "bg-white/5 border-white/5"
                    )}>
                      <span className="text-sm text-gray-400">{label}</span>
                      <span className={cn("font-mono font-bold", color)}>${val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Info className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold">Fundamentals</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500 uppercase mb-1">P/E Ratio</p>
                    <p className="text-xl font-mono font-bold">{data?.fundamentals.peRatio ?? "—"}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500 uppercase mb-1">EPS</p>
                    <p className="text-xl font-mono font-bold">{data?.fundamentals.eps ?? "—"}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 col-span-2">
                    <p className="text-xs text-gray-500 uppercase mb-1">Revenue Growth</p>
                    <p className="text-xl font-mono font-bold text-emerald-400">{data?.fundamentals.revenueGrowth ?? "—"}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Performance Card */}
            <section className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Performance Card
              </h3>
              <div className="space-y-4">
                {[{ label: "1 Day", key: "1D" }, { label: "1 Week", key: "1W" }, { label: "1 Month", key: "1M" }].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                    <span className="text-sm font-medium">{item.label}</span>
                    <div className={cn(
                      "flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full",
                      prediction?.[item.key] === "Bullish" ? "bg-emerald-500/20 text-emerald-400" :
                      prediction?.[item.key] === "Bearish" ? "bg-rose-500/20 text-rose-400" :
                      "bg-gray-500/20 text-gray-400"
                    )}>
                      {prediction?.[item.key] === "Bullish" ? <TrendingUp  className="w-3 h-3" /> :
                       prediction?.[item.key] === "Bearish" ? <TrendingDown className="w-3 h-3" /> : null}
                      {prediction?.[item.key] || "Neutral"}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Sentiment */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-blue-500" />
                News Sentiment
              </h3>
              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm text-gray-400 capitalize">{sentiment?.sentiment} Sentiment</span>
                  {/* ✅ FIX: correct confidence percentage */}
                  <span className="text-xs font-mono text-gray-500">{confidencePercent}% Confidence</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(sentiment?.score || 0.5) * 100}%` }}
                    className={cn(
                      "h-full transition-all duration-1000",
                      sentiment?.sentiment === "positive" ? "bg-emerald-500" :
                      sentiment?.sentiment === "negative" ? "bg-rose-500"    : "bg-blue-500"
                    )}
                  />
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 italic text-sm text-gray-300 leading-relaxed">
                "{sentiment?.summary}"
              </div>
            </section>

            {/* Market Context */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Market Context</h3>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="group cursor-pointer">
                    <p className="text-xs text-gray-500 mb-1">2 hours ago • Reuters</p>
                    <h4 className="text-sm font-medium group-hover:text-emerald-400 transition-colors">
                      {symbol} market dynamics shifting as global demand increases...
                    </h4>
                  </div>
                ))}
              </div>
            </section>

            {/* Watchlist */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                Quick Watchlist
              </h3>
              <div className="space-y-2">
                {["NVDA", "TSLA", "MSFT", "AMD"].map(s => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                      symbol === s
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border-white/5 hover:border-white/20 text-gray-400"
                    )}
                  >
                    <span className="font-bold">{s}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-50" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-white/5 text-center">
        <p className="text-gray-500 text-xs">
          © 2026 US Stock Analyzer. Data provided for informational purposes only. Not financial advice.
        </p>
      </footer>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-emerald-500 font-mono text-sm animate-pulse">ANALYZING MARKET DATA...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
