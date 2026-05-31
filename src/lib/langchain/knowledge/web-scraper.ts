// lib/knowledge/web-scraper.ts
// Uses Puppeteer for JS-rendered pages + cheerio for sitemap XML parsing
import * as cheerio from 'cheerio';
import puppeteer, { Browser } from 'puppeteer';
import { URL } from 'url';

export type PageScrapeStatus = 'ok' | 'skipped' | 'failed';

export type ScrapeProgressCallback = (
  current: number,
  total: number,
  url: string,
  bytesTotal: number,
  pagesOk: number,
  pageStatus: PageScrapeStatus,
) => void;

const BATCH_SIZE = 8;

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
  maxPages?: number,
  onProgress?: ScrapeProgressCallback
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  try {
    const validatedUrl = validateAndNormalizeURL(url);

    if (isSitemapUrl(validatedUrl)) {
      return await processSitemapDirectly(validatedUrl, maxPages, onProgress);
    }

    if (!crawlSubpages) {
      const page = await scrapePage(validatedUrl);
      onProgress?.(1, 1, validatedUrl, page.content.length, 1, 'ok');
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

    const pages = await crawlWebsite(validatedUrl, actualMaxPages, onProgress);
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
  maxPages?: number,
  onProgress?: ScrapeProgressCallback
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  return processSitemapDirectly(sitemapUrl, maxPages, onProgress);
}

// ─── Sitemap processing (cheerio — XML doesn't need JS) ──────────────────────

async function processSitemapDirectly(
  sitemapUrl: string,
  maxPages?: number,
  onProgress?: ScrapeProgressCallback
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
        return await scrapeUrlsFromList(allUrls, validatedUrl, maxPages, isSitemapIndex, childSitemaps, onProgress);
      }
      throw new Error('No URLs found in sitemap');
    }

    return await scrapeUrlsFromList(urls, validatedUrl, maxPages, isSitemapIndex, childSitemaps, onProgress);
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
  childSitemaps?: string[],
  onProgress?: ScrapeProgressCallback
): Promise<{ content: string; metadata: Record<string, unknown>; pages?: ScrapedPage[] }> {
  const pagesToScrape = Math.min(maxPages || urls.length, urls.length);
  console.log(`Sitemap: ${urls.length} URLs, scraping ${pagesToScrape} in batches of ${BATCH_SIZE}`);

  const pages: ScrapedPage[] = [];
  let processed = 0;
  let totalBytes = 0;
  const urlSlice = urls.slice(0, pagesToScrape);

  for (let i = 0; i < urlSlice.length; i += BATCH_SIZE) {
    const batch = urlSlice.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(url => scrapePage(url)));

    for (let j = 0; j < results.length; j++) {
      processed++;
      const url = batch[j];
      const result = results[j];
      let pageStatus: PageScrapeStatus = 'failed';

      if (result.status === 'fulfilled') {
        const page = result.value;
        if (page.metadata.wordCount > 80) {
          pages.push(page);
          totalBytes += page.content.length;
          pageStatus = 'ok';
        } else {
          console.log(`  ↳ Skipped ${url} (${page.metadata.wordCount} words)`);
          pageStatus = 'skipped';
        }
      } else {
        console.error(`Failed to scrape ${url}:`, result.reason);
        pageStatus = 'failed';
      }

      onProgress?.(processed, pagesToScrape, url, totalBytes, pages.length, pageStatus);
    }

    if (i + BATCH_SIZE < urlSlice.length) await delay(500);
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

export async function scrapePage(url: string): Promise<ScrapedPage & { wordCount: number }> {
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

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for JS-rendered content — try to find main content selector
    try {
      await page.waitForSelector('main, article, [role="main"], .content, #content', { timeout: 5000 });
    } catch { /* page may not have these selectors — continue anyway */ }

    await delay(1200);

    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(400);

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

    // Detect JS-loaded empty pages — content is just error/login messages
    const USELESS_PATTERNS = [
      /no destinations found/i,
      /sign in to manage your account/i,
      /welcome back.*sign in/i,
      /0 destinations/i,
      /no posts found/i,
      /check back soon/i,
      /page not found/i,
      /404/i,
    ];
    const isUseless = USELESS_PATTERNS.some(p => p.test(result.content));
    const finalContent = isUseless ? '' : result.content;

    return {
      url,
      content: finalContent,
      title: result.title,
      wordCount: countWords(finalContent),
      metadata: {
        description: result.description,
        keywords: result.keywords,
        author: result.author,
        wordCount: countWords(finalContent),
        links: result.links,
        images: result.images,
      },
    };
  } finally {
    await page.close();
  }
}

// ─── Crawl website ────────────────────────────────────────────────────────────

async function crawlWebsite(startUrl: string, maxPages: number, onProgress?: ScrapeProgressCallback): Promise<ScrapedPage[]> {
  const sitemapInfo = await discoverSitemaps(startUrl);

  const allUrls = [startUrl];
  if (sitemapInfo.urls.length > 0) {
    allUrls.push(...sitemapInfo.urls);
  }

  const uniqueUrls = [...new Set(allUrls)].slice(0, maxPages);
  const total = uniqueUrls.length;
  const pages: ScrapedPage[] = [];
  let processed = 0;
  let totalBytes = 0;

  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    if (pages.length >= maxPages) break;

    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(url => scrapePage(url)));

    for (let j = 0; j < results.length; j++) {
      processed++;
      const url = batch[j];
      const result = results[j];
      let pageStatus: PageScrapeStatus = 'failed';

      if (result.status === 'fulfilled') {
        const page = result.value;
        if (page.metadata.wordCount > 80) {
          pages.push(page);
          totalBytes += page.content.length;
          pageStatus = 'ok';
        } else {
          pageStatus = 'skipped';
        }
        console.log(`Scraped: ${url} (${processed}/${total}) [${pageStatus}]`);
      } else {
        console.error(`Failed to scrape ${url}:`, result.reason);
        pageStatus = 'failed';
      }

      onProgress?.(processed, total, url, totalBytes, pages.length, pageStatus);
    }

    if (i + BATCH_SIZE < uniqueUrls.length) await delay(500);
  }

  return pages;
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
