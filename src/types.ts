export interface StockData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  fundamentals: {
    peRatio: string;
    eps: string;
    revenueGrowth: string;
  };
  history: { date: string; price: string }[];
}

export interface TradeSetup {
  entry: number;
  tp1: number;
  tp2: number;
  sl: number;
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  summary: string;
}
