/**
 * Undici response handling utilities.
 * Parses HTTP responses into ScrapeResult with content extraction.
 */

import type { Dispatcher } from "undici";
import type { ScrapeResult, ProgressCallback } from "../../domain/schemas.js";
import {
  htmlToText,
  htmlToMarkdown,
  extractLinks,
  extractMedia,
  extractMetadata,
} from "../../utils/content-parser.js";

/** Extraction flags for response parsing. */
export interface ExtractionFlags {
  shouldExtractMedia: boolean;
  shouldExtractLinks: boolean;
  shouldExtractMetadata: boolean;
}

/** Parse an undici response into a ScrapeResult. */
export async function parseUndiciResponse(
  response: Dispatcher.ResponseData,
  url: string,
  startTime: number,
  flags: ExtractionFlags,
): Promise<ScrapeResult> {
  const html = await response.body.text();
  const contentType = (response.headers["content-type"] as string) || "";

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? htmlToText(titleMatch[1] || "") : "";

  const result: ScrapeResult = {
    url: response.headers["location"]
      ? new URL(response.headers["location"] as string, url).href
      : url,
    title,
    content: htmlToText(html),
    markdown: htmlToMarkdown(html),
    html,
    statusCode: response.statusCode,
    contentType,
    loadTime: Date.now() - startTime,
  };

  if (flags.shouldExtractLinks) result.links = extractLinks(html, url);
  if (flags.shouldExtractMedia) result.media = extractMedia(html, url);
  if (flags.shouldExtractMetadata) result.metadata = extractMetadata(html);

  return result;
}
