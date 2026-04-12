import { StockData, TradeSetup } from "../types";

export async function fetchStockData(symbol: string): Promise<StockData> {
  const response = await fetch(`/api/stock/${symbol}`);
  if (!response.ok) throw new Error("Failed to fetch stock data");
  return response.json();
}

export function calculateTradeSetup(price: number): TradeSetup {
  // Simple algorithm to calculate entry/exit based on current price
  // In a real app, this would use support/resistance levels from historical data
  const entry = price;
  const tp1 = price * 1.05; // 5% profit
  const tp2 = price * 1.10; // 10% profit
  const sl = price * 0.97;  // 3% stop loss
  
  return {
    entry: Number(entry.toFixed(2)),
    tp1: Number(tp1.toFixed(2)),
    tp2: Number(tp2.toFixed(2)),
    sl: Number(sl.toFixed(2))
  };
}
