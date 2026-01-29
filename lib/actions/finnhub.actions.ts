"use server";

import { cache } from "react";
import { getDateRange, validateArticle, formatArticle } from "@/lib/utils";
import { POPULAR_STOCK_SYMBOLS } from "../contants";

// Constants
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const NEXT_PUBLIC_FINNHUB_API_KEY =
  process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? "";

// Fetch JSON helper with optional caching
async function fetchJSON<T>(
  url: string,
  revalidateSeconds?: number,
): Promise<T> {
  const options: RequestInit & { next?: { revalidate: number } } =
    revalidateSeconds
      ? { cache: "force-cache", next: { revalidate: revalidateSeconds } }
      : { cache: "no-store" };

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return (await response.json()) as T;
}

// Get news with optional symbol filtering and round-robin distribution
export const getNews = async (
  symbols?: string[],
): Promise<MarketNewsArticle[]> => {
  try {
    const { from, to } = getDateRange(5); // Last 5 days
    const apiKey = NEXT_PUBLIC_FINNHUB_API_KEY;

    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_FINNHUB_API_KEY is not defined");
    }

    // If symbols provided, use round-robin to fetch company news
    if (symbols && symbols.length > 0) {
      // Clean and uppercase symbols
      const cleanedSymbols = symbols
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      if (cleanedSymbols.length === 0) {
        return await fetchGeneralMarketNews(from, to, apiKey);
      }

      // Round-robin through symbols, max 6 iterations
      const allArticles: MarketNewsArticle[] = [];
      const maxRounds = 6;

      for (let round = 0; round < maxRounds; round++) {
        const symbolIndex = round % cleanedSymbols.length;
        const symbol = cleanedSymbols[symbolIndex];

        try {
          const url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`;
          const companyNews: RawNewsArticle[] = await fetchJSON(url);

          // Find the first valid article from this round
          const validArticle = companyNews.find(validateArticle);

          if (validArticle) {
            allArticles.push(formatArticle(validArticle, true, symbol, round));
          }
        } catch (error) {
          console.error(`Error fetching news for ${symbol}:`, error);
          // Continue to next symbol
        }

        // Stop if we have 6 articles
        if (allArticles.length >= 6) {
          break;
        }
      }

      // Sort by datetime (most recent first)
      allArticles.sort((a, b) => b.datetime - a.datetime);

      return allArticles.slice(0, 6);
    }

    // No symbols provided, fetch general market news
    return await fetchGeneralMarketNews(from, to, apiKey);
  } catch (error) {
    console.error("Failed to fetch news:", error);
    throw new Error("Failed to fetch news");
  }
};

// Helper function to fetch general market news
async function fetchGeneralMarketNews(
  from: string,
  to: string,
  apiKey: string,
): Promise<MarketNewsArticle[]> {
  const url = `${FINNHUB_BASE_URL}/news?category=general&token=${apiKey}`;
  const marketNews: RawNewsArticle[] = await fetchJSON(url);

  // Deduplicate by id, url, or headline
  const seen = new Set<string>();
  const uniqueArticles: RawNewsArticle[] = [];

  for (const article of marketNews) {
    const key = `${article.id}-${article.url}-${article.headline}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueArticles.push(article);
    }
  }

  // Validate and take top 6
  const validArticles = uniqueArticles
    .filter(validateArticle)
    .slice(0, 6)
    .map((article, index) => formatArticle(article, false, undefined, index));

  return validArticles;
}

export const searchStocks = cache(
  async (query?: string): Promise<StockWithWatchlistStatus[]> => {
    try {
      const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
      if (!token) {
        // If no token, log and return empty to avoid throwing per requirements
        console.error(
          "Error in stock search:",
          new Error("FINNHUB API key is not configured"),
        );
        return [];
      }

      const trimmed = typeof query === "string" ? query.trim() : "";

      let results: FinnhubSearchResult[] = [];

      if (!trimmed) {
        // Fetch top 10 popular symbols' profiles
        const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
        const profiles = await Promise.all(
          top.map(async (sym) => {
            try {
              const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
              // Revalidate every hour
              const profile = await fetchJSON<any>(url, 3600);
              return { sym, profile } as { sym: string; profile: any };
            } catch (e) {
              console.error("Error fetching profile2 for", sym, e);
              return { sym, profile: null } as { sym: string; profile: any };
            }
          }),
        );

        results = profiles
          .map(({ sym, profile }) => {
            const symbol = sym.toUpperCase();
            const name: string | undefined =
              profile?.name || profile?.ticker || undefined;
            const exchange: string | undefined = profile?.exchange || undefined;
            if (!name) return undefined;
            const r: FinnhubSearchResult = {
              symbol,
              description: name,
              displaySymbol: symbol,
              type: "Common Stock",
            };
            // We don't include exchange in FinnhubSearchResult type, so carry via mapping later using profile
            // To keep pipeline simple, attach exchange via closure map stage
            // We'll reconstruct exchange when mapping to final type
            (r as any).__exchange = exchange; // internal only
            return r;
          })
          .filter((x): x is FinnhubSearchResult => Boolean(x));
      } else {
        const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
        const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
        results = Array.isArray(data?.result) ? data.result : [];
      }

      const mapped: StockWithWatchlistStatus[] = results
        .map((r) => {
          const upper = (r.symbol || "").toUpperCase();
          const name = r.description || upper;
          const exchangeFromDisplay =
            (r.displaySymbol as string | undefined) || undefined;
          const exchangeFromProfile = (r as any).__exchange as
            | string
            | undefined;
          const exchange = exchangeFromDisplay || exchangeFromProfile || "US";
          const type = r.type || "Stock";
          const item: StockWithWatchlistStatus = {
            symbol: upper,
            name,
            exchange,
            type,
            isInWatchlist: false,
          };
          return item;
        })
        .slice(0, 15);

      return mapped;
    } catch (err) {
      console.error("Error in stock search:", err);
      return [];
    }
  },
);
