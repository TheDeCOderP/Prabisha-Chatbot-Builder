// lib/knowledge/web-scraper.ts
// Uses Puppeteer for JS-rendered pages + cheerio for sitemap XML parsing
import * as cheerio from 'cheerio';
import puppeteer, { Browser } from 'puppeteer';
import { URL } from 'url';

interface ScrapedPage {
  url: string;
  content: string;
  title: string;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    lastModified?: string;
    wordCount: number;
    links: number;
    images: number;
  };
}

interface SitemapInfo {
  urls: string[];
  totalPages: number;
  isSitemapIndex: boolean;
  childSitemaps?: string[];
}

// ─── Browser singleton ────────────────────────────────────────────────────────
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  });
  return browserInstance;
}

async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

// ─── Main public API ──────────────────────────────────────────────────────────

export async function processURL(
  url: string,
  crawlSubpages: boolean = false,
  maxPages?: number
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  try {
    const validatedUrl = validateAndNormalizeURL(url);

    if (isSitemapUrl(validatedUrl)) {
      return await processSitemapDirectly(validatedUrl, maxPages);
    }

    if (!crawlSubpages) {
      const page = await scrapePage(validatedUrl);
      return {
        content: page.content,
        metadata: { ...page.metadata, url: page.url, title: page.title, scrapedAt: new Date().toISOString(), pageCount: 1 },
      };
    }

    let actualMaxPages = maxPages;
    if (!actualMaxPages) {
      const sitemapInfo = await discoverSitemaps(validatedUrl);
      actualMaxPages = sitemapInfo.totalPages > 0
        ? Math.min(sitemapInfo.totalPages, 100)
        : 50;
    }

    const pages = await crawlWebsite(validatedUrl, actualMaxPages);
    const combinedContent = pages
      .map((p, i) => `\n\n--- Page ${i + 1}: ${p.title} (${p.url}) ---\n\n${p.content}`)
      .join('\n');

    return {
      content: combinedContent,
      metadata: {
        url: validatedUrl,
        scrapedAt: new Date().toISOString(),
        pageCount: pages.length,
        maxPagesRequested: actualMaxPages,
        totalWordCount: pages.reduce((s, p) => s + p.metadata.wordCount, 0),
        pages: pages.map(p => ({ url: p.url, title: p.title, wordCount: p.metadata.wordCount })),
      },
      pages,
    };
  } catch (error) {
    throw new Error(`Failed to process URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await closeBrowser();
  }
}

export async function processSitemap(
  sitemapUrl: string,
  maxPages?: number
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  return processSitemapDirectly(sitemapUrl, maxPages);
}

// ─── Sitemap processing (cheerio — XML doesn't need JS) ──────────────────────

async function processSitemapDirectly(
  sitemapUrl: string,
  maxPages?: number
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  try {
    const validatedUrl = validateAndNormalizeURL(sitemapUrl);
    const { urls, isSitemapIndex, childSitemaps } = await extractSitemapInfo(validatedUrl);

    if (urls.length === 0) {
      if (childSitemaps && childSitemaps.length > 0) {
        const allUrls: string[] = [];
        for (const childUrl of childSitemaps.slice(0, 3)) {
          try {
            const childInfo = await extractSitemapInfo(childUrl);
            allUrls.push(...childInfo.urls);
          } catch { /* skip failed child sitemaps */ }
        }
        if (allUrls.length === 0) throw new Error('No URLs found in child sitemaps');
        return await scrapeUrlsFromList(allUrls, validatedUrl, maxPages, isSitemapIndex, childSitemaps);
      }
      throw new Error('No URLs found in sitemap');
    }

    return await scrapeUrlsFromList(urls, validatedUrl, maxPages, isSitemapIndex, childSitemaps);
  } catch (error) {
    throw new Error(`Failed to process sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await closeBrowser();
  }
}

async function scrapeUrlsFromList(
  urls: string[],
  sitemapUrl: string,
  maxPages?: number,
  isSitemapIndex = false,
  childSitemaps?: string[]
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  const pagesToScrape = Math.min(maxPages || urls.length, urls.length);
  console.log(`Sitemap contains ${urls.length} URLs. Scraping ${pagesToScrape} pages.`);

  const pages: ScrapedPage[] = [];
  for (const url of urls.slice(0, pagesToScrape)) {
    try {
      console.log(`Scraping: ${url} (${pages.length + 1}/${pagesToScrape})`);
      const page = await scrapePage(url);
      // Skip pages with no meaningful content
      if (page.metadata.wordCount > 20) {
        pages.push(page);
      } else {
        console.log(`  ↳ Skipped (${page.metadata.wordCount} words — too little content)`);
        // Still push so document record is created, but content will be empty
        pages.push(page);
      }
      await delay(500);
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
    }
  }

  if (pages.length === 0) throw new Error('Failed to scrape any pages from sitemap');

  const combinedContent = pages
    .map((p, i) => `\n\n--- Page ${i + 1}: ${p.title} (${p.url}) ---\n\n${p.content}`)
    .join('\n');

  return {
    content: combinedContent,
    metadata: {
      sitemapUrl,
      scrapedAt: new Date().toISOString(),
      pageCount: pages.length,
      totalPagesInSitemap: urls.length,
      sitemapStats: { isSitemapIndex, childSitemaps: childSitemaps?.length || 0, urlsFound: urls.length },
      maxPagesRequested: pagesToScrape,
      totalWordCount: pages.reduce((s, p) => s + p.metadata.wordCount, 0),
      pages: pages.map(p => ({ url: p.url, title: p.title, wordCount: p.metadata.wordCount })),
    },
    pages,
  };
}

// ─── Sitemap discovery & parsing (cheerio) ────────────────────────────────────

async function discoverSitemaps(baseUrl: string): Promise<SitemapInfo> {
  const urls: string[] = [];
  const childSitemaps: string[] = [];
  let isSitemapIndex = false;
  const parsedUrl = new URL(baseUrl);

  const candidates = [
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap.xml`,
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap_index.xml`,
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap-index.xml`,
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap`,
  ];

  for (const sitemapUrl of [...new Set(candidates)]) {
    try {
      const result = await extractSitemapInfo(sitemapUrl);
      if (result.urls.length > 0) {
        urls.push(...result.urls);
        if (result.isSitemapIndex) {
          isSitemapIndex = true;
          if (result.childSitemaps) childSitemaps.push(...result.childSitemaps);
        }
        break;
      }
    } catch { continue; }
  }

  return { urls: [...new Set(urls)], totalPages: urls.length, isSitemapIndex, childSitemaps: childSitemaps.length > 0 ? [...new Set(childSitemaps)] : undefined };
}

async function extractSitemapInfo(sitemapUrl: string): Promise<SitemapInfo> {
  const urls: string[] = [];
  const childSitemaps: string[] = [];
  let isSitemapIndex = false;

  const xml = await fetchXML(sitemapUrl);
  const $ = cheerio.load(xml, { xmlMode: true });

  if ($('sitemap').length > 0) {
    isSitemapIndex = true;
    $('sitemap > loc').each((_, el) => {
      const u = $(el).text().trim();
      if (u) childSitemaps.push(u);
    });

    const childPromises = childSitemaps.slice(0, 5).map(async (childUrl) => {
      try {
        const info = await extractSitemapInfo(childUrl);
        urls.push(...info.urls);
      } catch { /* skip */ }
    });
    await Promise.all(childPromises);
  }

  $('url > loc').each((_, el) => {
    const u = $(el).text().trim();
    if (u) urls.push(u);
  });

  $('loc').each((_, el) => {
    const u = $(el).text().trim();
    if (u && !urls.includes(u)) {
      const isSitemap = u.toLowerCase().includes('sitemap') && u.toLowerCase().endsWith('.xml');
      if (!isSitemap) urls.push(u);
    }
  });

  return { urls: [...new Set(urls)], totalPages: urls.length, isSitemapIndex, childSitemaps: childSitemaps.length > 0 ? [...new Set(childSitemaps)] : undefined };
}

// ─── Page scraping (Puppeteer) ────────────────────────────────────────────────

async function scrapePage(url: string): Promise<ScrapedPage> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Block images, fonts, media to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (compatible; KnowledgeBot/1.0)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Wait a bit for any lazy-loaded content
    await delay(1000);

    const result = await page.evaluate(() => {
      // Remove noise elements
      const remove = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript', '[class*="cookie"]', '[id*="cookie"]', '[class*="banner"]', '[class*="popup"]'];
      remove.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));

      const title = document.title?.trim() || document.querySelector('h1')?.textContent?.trim() || 'Untitled';
      const description = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content || '';
      const keywords = (document.querySelector('meta[name="keywords"]') as HTMLMetaElement)?.content || '';
      const author = (document.querySelector('meta[name="author"]') as HTMLMetaElement)?.content || '';

      // Find main content area
      const mainSelectors = ['main', 'article', '[role="main"]', '.main-content', '#main-content', '.content', '#content', '.entry-content', '.post-content'];
      let mainEl: Element | null = null;
      for (const sel of mainSelectors) {
        mainEl = document.querySelector(sel);
        if (mainEl) break;
      }
      if (!mainEl) mainEl = document.body;

      // Extract text from meaningful elements
      let content = '';
      mainEl.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 10) content += text + '\n\n';
      });

      content = content.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();

      const links = mainEl.querySelectorAll('a[href]').length;
      const images = mainEl.querySelectorAll('img').length;

      return { title, description, keywords, author, content, links, images };
    });

    return {
      url,
      content: result.content,
      title: result.title,
      metadata: {
        description: result.description,
        keywords: result.keywords,
        author: result.author,
        wordCount: countWords(result.content),
        links: result.links,
        images: result.images,
      },
    };
  } finally {
    await page.close();
  }
}

// ─── Crawl website ────────────────────────────────────────────────────────────

async function crawlWebsite(startUrl: string, maxPages: number): Promise<ScrapedPage[]> {
  const visited = new Set<string>();
  const toVisit: string[] = [startUrl];
  const scrapedPages: ScrapedPage[] = [];

  const sitemapInfo = await discoverSitemaps(startUrl);
  if (sitemapInfo.urls.length > 0) {
    toVisit.push(...sitemapInfo.urls.slice(0, maxPages));
  }

  while (toVisit.length > 0 && scrapedPages.length < maxPages) {
    const currentUrl = toVisit.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      console.log(`Scraping: ${currentUrl} (${scrapedPages.length + 1}/${maxPages})`);
      const page = await scrapePage(currentUrl);
      scrapedPages.push(page);
      await delay(500);
    } catch (error) {
      console.error(`Failed to scrape ${currentUrl}:`, error);
    }
  }

  return scrapedPages;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchXML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)', 'Accept': 'application/xml,text/xml,*/*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.text();
}

function isSitemapUrl(url: string): boolean {
  const l = url.toLowerCase();
  return l.includes('sitemap') && (l.endsWith('.xml') || l.includes('sitemap.xml') || l.includes('sitemap_index.xml') || l.includes('sitemap-index.xml'));
}

function validateAndNormalizeURL(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  const parsed = new URL(url);
  return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
}

function resolveURL(href: string, baseUrl: string): string | null {
  try {
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('#')) return null;
    const abs = new URL(href, baseUrl);
    const ext = abs.pathname.split('.').pop()?.toLowerCase();
    if (ext && ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'mp4', 'mp3', 'zip', 'exe'].includes(ext)) return null;
    return abs.href;
  } catch { return null; }
}

function isSameDomain(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === baseDomain || parsed.hostname.endsWith('.' + baseDomain);
  } catch { return false; }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const webScraperUtils = {
  validateAndNormalizeURL,
  resolveURL,
  isSameDomain,
  countWords,
  isSitemapUrl,
  extractSitemapInfo,
  discoverSitemaps,
};
