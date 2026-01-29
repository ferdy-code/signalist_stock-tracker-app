"use server";

import { getDateRange, validateArticle, formatArticle } from "@/lib/utils";

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
