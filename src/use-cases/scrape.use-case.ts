/**
 * Scrape Use Case
 * High-level API for scraping web pages.
 */

import type { ScraperPort, ScrapeResponse } from "../ports/index.js";
import type {
  ScrapeResult,
  ScrapeOptions,
  ProgressCallback,
} from "../domain/schemas.js";
import { PlaywrightScraperAdapter } from "../adapters/playwright/scraper.adapter.js";
import { FetchScraperAdapter } from "../adapters/fetch/scraper.adapter.js";

export interface ScrapeUseCaseOptions extends Partial<ScrapeOptions> {
  /**
   * Prefer Playwright for JS-heavy sites
   */
  preferBrowser?: boolean;

  /**
   * Fallback to fetch if browser unavailable
   */
  fallbackToFetch?: boolean;

  /**
   * Progress callback
   */
  onProgress?: ProgressCallback;

  /**
   * Abort signal
   */
  signal?: AbortSignal;
}

/**
 * ScrapeUseCase - Intelligent scraping with fallback
 */
export class ScrapeUseCase {
  private playwrightScraper: ScraperPort;
  private fetchScraper: ScraperPort;

  constructor() {
    this.playwrightScraper = new PlaywrightScraperAdapter();
    this.fetchScraper = new FetchScraperAdapter();
  }

  /**
   * Scrape a URL with automatic adapter selection
   */
  async execute(
    url: string,
    options: ScrapeUseCaseOptions = {},
  ): Promise<ScrapeResponse> {
    const {
      preferBrowser = false,
      fallbackToFetch = true,
      waitFor,
      ...scrapeOptions
    } = options;

    // Determine if we need browser
    const needsBrowser = preferBrowser || waitFor === "networkidle";

    if (needsBrowser) {
      try {
        if (await this.playwrightScraper.isAvailable()) {
          return await this.playwrightScraper.scrape(url, {
            ...scrapeOptions,
            waitFor,
          });
        }
      } catch (error) {
        if (!fallbackToFetch) throw error;
        // Fall through to fetch
      }
    }

    // Use fetch (fast path)
    return this.fetchScraper.scrape(url, scrapeOptions);
  }

  /**
   * Scrape multiple URLs
   */
  async executeMany(
    urls: string[],
    options: ScrapeUseCaseOptions & { concurrency?: number } = {},
  ): Promise<Map<string, ScrapeResult>> {
    const {
      preferBrowser,
      concurrency = 5,
      onProgress,
      signal,
      ...rest
    } = options;

    const scraper = preferBrowser ? this.playwrightScraper : this.fetchScraper;

    const result = await scraper.scrapeMany(urls, {
      concurrency,
      onProgress,
      signal,
      ...rest,
    });
    return result.results;
  }

  /**
   * Get available scrapers
   */
  async getAvailableScrapers(): Promise<string[]> {
    const available: string[] = ["fetch"];

    if (await this.playwrightScraper.isAvailable()) {
      available.push("playwright");
    }

    return available;
  }
}

/**
 * Create a scrape use case
 */
export function createScrapeUseCase(): ScrapeUseCase {
  return new ScrapeUseCase();
}
