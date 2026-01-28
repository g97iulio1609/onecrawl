/**
 * Content Parser - Extract content from HTML
 */

import type { Link, Metadata, ExtractedMedia } from "../domain/schemas.js";
import { normalizeUrl, isAbsoluteUrl } from "./url-builder.js";

/**
 * Remove HTML tags and get plain text
 */
export function htmlToText(html: string): string {
  return (
    html
      // Remove script and style elements
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove tags
      .replace(/<[^>]+>/g, " ")
      // Decode HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Simple HTML to Markdown conversion
 */
export function htmlToMarkdown(html: string): string {
  let md = html
    // Remove script and style
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n")
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n")
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    // Line breaks
    .replace(/<br\s*\/?>/gi, "\n")
    // Bold
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, "**$2**")
    // Italic
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, "*$2*")
    // Code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    // Links
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    // Images
    .replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)")
    .replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, "![]($1)")
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?[uo]l[^>]*>/gi, "\n")
    // Blockquotes
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n\n")
    // Horizontal rule
    .replace(/<hr\s*\/?>/gi, "\n---\n\n")
    // Remove remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return md;
}

/**
 * Extract links from HTML
 */
export function extractLinks(html: string, baseUrl: string): Link[] {
  const links: Link[] = [];
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1] || "";
    const text = htmlToText(match[2] || "");

    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      continue;
    }

    const normalizedUrl = normalizeUrl(href, baseUrl);
    const isExternal = !normalizedUrl.startsWith(new URL(baseUrl).origin);

    links.push({
      href: normalizedUrl,
      text: text.slice(0, 200),
      isExternal,
    });
  }

  return links;
}

/**
 * Extract images from HTML
 */
export function extractImages(
  html: string,
  baseUrl: string,
): ExtractedMedia["images"] {
  const images: NonNullable<ExtractedMedia["images"]> = [];
  const imgRegex = /<img[^>]+>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src="([^"]*)"/i);
    const altMatch = tag.match(/alt="([^"]*)"/i);
    const titleMatch = tag.match(/title="([^"]*)"/i);
    const widthMatch = tag.match(/width="(\d+)"/i);
    const heightMatch = tag.match(/height="(\d+)"/i);

    if (!srcMatch?.[1]) continue;

    const src = srcMatch[1];

    // Skip data URIs and tracking pixels
    if (
      src.startsWith("data:") ||
      src.includes("1x1") ||
      src.includes("pixel")
    ) {
      continue;
    }

    images.push({
      src: isAbsoluteUrl(src) ? src : normalizeUrl(src, baseUrl),
      alt: altMatch?.[1],
      title: titleMatch?.[1],
      width: widthMatch ? parseInt(widthMatch[1]!, 10) : undefined,
      height: heightMatch ? parseInt(heightMatch[1]!, 10) : undefined,
    });
  }

  return images;
}

/**
 * Extract videos from HTML
 */
export function extractVideos(
  html: string,
  baseUrl: string,
): ExtractedMedia["videos"] {
  const videos: NonNullable<ExtractedMedia["videos"]> = [];

  // Video tags
  const videoRegex = /<video[^>]*>[\s\S]*?<\/video>/gi;
  let match;

  while ((match = videoRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch =
      tag.match(/src="([^"]*)"/i) || tag.match(/<source[^>]+src="([^"]*)"/i);

    if (srcMatch?.[1]) {
      videos.push({
        src: normalizeUrl(srcMatch[1], baseUrl),
      });
    }
  }

  // YouTube embeds
  const ytRegex =
    /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/gi;
  while ((match = ytRegex.exec(html)) !== null) {
    videos.push({
      src: `https://www.youtube.com/watch?v=${match[1]}`,
      embedUrl: `https://www.youtube.com/embed/${match[1]}`,
      provider: "youtube",
    });
  }

  // Vimeo embeds
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/gi;
  while ((match = vimeoRegex.exec(html)) !== null) {
    videos.push({
      src: `https://vimeo.com/${match[1]}`,
      embedUrl: `https://player.vimeo.com/video/${match[1]}`,
      provider: "vimeo",
    });
  }

  return videos;
}

/**
 * Extract metadata from HTML
 */
export function extractMetadata(html: string): Metadata {
  const metadata: Metadata = {};

  // Title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) metadata.title = htmlToText(titleMatch[1] || "");

  // Meta tags helper
  const getMeta = (name: string): string | undefined => {
    const regex = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const altRegex = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
      "i",
    );
    const match = html.match(regex) || html.match(altRegex);
    return match?.[1];
  };

  // Standard meta
  metadata.description = getMeta("description");
  metadata.author = getMeta("author");

  // Open Graph
  metadata.ogTitle = getMeta("og:title");
  metadata.ogDescription = getMeta("og:description");
  metadata.ogImage = getMeta("og:image");
  metadata.ogType = getMeta("og:type");

  // Twitter
  metadata.twitterCard = getMeta("twitter:card");
  metadata.twitterTitle = getMeta("twitter:title");
  metadata.twitterDescription = getMeta("twitter:description");
  metadata.twitterImage = getMeta("twitter:image");

  // Canonical
  const canonicalMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i,
  );
  if (canonicalMatch) metadata.canonical = canonicalMatch[1];

  // Language
  const langMatch = html.match(/<html[^>]+lang=["']([^"']*)["']/i);
  if (langMatch) metadata.lang = langMatch[1];

  // JSON-LD
  const jsonLdMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const structuredData: Record<string, unknown>[] = [];
  for (const m of jsonLdMatches) {
    try {
      structuredData.push(JSON.parse(m[1] || "{}"));
    } catch {
      // Invalid JSON-LD
    }
  }
  if (structuredData.length > 0) {
    metadata.structuredData = structuredData;
  }

  return metadata;
}

/**
 * Extract all media from HTML
 */
export function extractMedia(html: string, baseUrl: string): ExtractedMedia {
  return {
    images: extractImages(html, baseUrl),
    videos: extractVideos(html, baseUrl),
  };
}
