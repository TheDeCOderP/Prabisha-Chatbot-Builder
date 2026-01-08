// lib/knowledge/webScraper.ts
import * as cheerio from 'cheerio';
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

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

/**
 * Main function to process a URL with optional crawling
 */
export async function processURL(
  url: string,
  crawlSubpages: boolean = false,
  maxPages: number = 50
): Promise<{
  content: string;
  metadata: any;
  pages?: ScrapedPage[];
}> {
  try {
    // Validate URL
    const validatedUrl = validateAndNormalizeURL(url);
    
    if (!crawlSubpages) {
      // Just scrape the single page
      const page = await scrapePage(validatedUrl);
      return {
        content: page.content,
        metadata: {
          ...page.metadata,
          url: page.url,
          title: page.title,
          scrapedAt: new Date().toISOString(),
          pageCount: 1,
        },
      };
    }

    // Crawl multiple pages
    const pages = await crawlWebsite(validatedUrl, maxPages);
    
    // Combine all content
    const combinedContent = pages
      .map((page, index) => {
        return `\n\n--- Page ${index + 1}: ${page.title} (${page.url}) ---\n\n${page.content}`;
      })
      .join('\n');

    return {
      content: combinedContent,
      metadata: {
        url: validatedUrl,
        scrapedAt: new Date().toISOString(),
        pageCount: pages.length,
        totalWordCount: pages.reduce((sum, p) => sum + p.metadata.wordCount, 0),
        pages: pages.map(p => ({
          url: p.url,
          title: p.title,
          wordCount: p.metadata.wordCount,
        })),
      },
      pages,
    };
  } catch (error) {
    throw new Error(`Failed to process URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Crawl website starting from a URL
 */
async function crawlWebsite(
  startUrl: string,
  maxPages: number
): Promise<ScrapedPage[]> {
  const baseUrl = new URL(startUrl);
  const baseDomain = baseUrl.hostname;
  
  const visited = new Set<string>();
  const toVisit: string[] = [startUrl];
  const scrapedPages: ScrapedPage[] = [];

  // Try to get URLs from sitemap first
  const sitemapUrls = await getSitemapUrls(startUrl);
  if (sitemapUrls.length > 0) {
    console.log(`Found ${sitemapUrls.length} URLs in sitemap`);
    toVisit.push(...sitemapUrls.slice(0, maxPages));
  }

  while (toVisit.length > 0 && scrapedPages.length < maxPages) {
    const currentUrl = toVisit.shift()!;
    
    // Skip if already visited
    if (visited.has(currentUrl)) {
      continue;
    }
    
    visited.add(currentUrl);

    try {
      console.log(`Scraping: ${currentUrl} (${scrapedPages.length + 1}/${maxPages})`);
      
      const page = await scrapePage(currentUrl);
      scrapedPages.push(page);

      // Extract links from the page if we haven't reached max pages
      if (scrapedPages.length < maxPages && sitemapUrls.length === 0) {
        const html = await fetchHTML(currentUrl);
        const $ = cheerio.load(html);
        
        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (href) {
            const absoluteUrl = resolveURL(href, currentUrl);
            
            // Only add URLs from the same domain
            if (absoluteUrl && isSameDomain(absoluteUrl, baseDomain) && !visited.has(absoluteUrl)) {
              toVisit.push(absoluteUrl);
            }
          }
        });
      }

      // Add delay to be respectful to the server
      await delay(1000);
    } catch (error) {
      console.error(`Failed to scrape ${currentUrl}:`, error);
    }
  }

  return scrapedPages;
}

/**
 * Get URLs from sitemap.xml
 */
async function getSitemapUrls(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const parsedUrl = new URL(baseUrl);
  const sitemapUrls = [
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap`,
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap.xml`,
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap_index.xml`,
    `${parsedUrl.protocol}//${parsedUrl.host}/sitemap-index.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const xml = await fetchHTML(sitemapUrl);
      const $ = cheerio.load(xml, { xmlMode: true });
      
      // Check if this is a sitemap index
      $('sitemap loc').each((_, element) => {
        const childSitemapUrl = $(element).text().trim();
        if (childSitemapUrl) {
          // Recursively fetch child sitemaps
          fetchHTML(childSitemapUrl)
            .then(childXml => {
              const $child = cheerio.load(childXml, { xmlMode: true });
              $child('url loc').each((_, el) => {
                const url = $child(el).text().trim();
                if (url) urls.push(url);
              });
            })
            .catch(() => {});
        }
      });

      // Get regular URLs
      $('url loc').each((_, element) => {
        const url = $(element).text().trim();
        if (url) {
          urls.push(url);
        }
      });

      if (urls.length > 0) {
        console.log(`Found sitemap at ${sitemapUrl} with ${urls.length} URLs`);
        break;
      }
    } catch (error) {
      // Sitemap not found, try next URL
      continue;
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Scrape a single page
 */
async function scrapePage(url: string): Promise<ScrapedPage> {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, nav, footer, header, iframe, noscript').remove();
  $('.advertisement, .ads, #cookie-banner, .cookie-notice').remove();

  // Extract metadata
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                'Untitled Page';
  
  const description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || 
                      '';
  
  const keywords = $('meta[name="keywords"]').attr('content') || '';
  const author = $('meta[name="author"]').attr('content') || '';
  const lastModified = $('meta[name="last-modified"]').attr('content') || 
                       $('meta[property="article:modified_time"]').attr('content') || 
                       '';

  // Extract main content
  let content = '';
  
  // Try to find main content area
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main-content',
    '.content',
    '#content',
  ];

  let mainSelector = 'body';
  for (const selector of mainSelectors) {
    if ($(selector).length > 0) {
      mainSelector = selector;
      break;
    }
  }

  // Extract text from paragraphs, headings, and lists
  $(`${mainSelector}`).find('h1, h2, h3, h4, h5, h6, p, li, td, th').each((_, element) => {
    const text = $(element).text().trim();
    if (text) {
      content += text + '\n\n';
    }
  });

  // Clean up content
  content = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Count links and images
  const links = $(`${mainSelector}`).find('a[href]').length;
  const images = $(`${mainSelector}`).find('img').length;

  return {
    url,
    content,
    title,
    metadata: {
      description,
      keywords,
      author,
      lastModified,
      wordCount: countWords(content),
      links,
      images,
    },
  };
}

/**
 * Fetch HTML from a URL
 */
async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xml')) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  return await response.text();
}

/**
 * Validate and normalize URL
 */
function validateAndNormalizeURL(url: string): string {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const parsed = new URL(url);
    
    // Remove trailing slash and fragments
    return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Resolve relative URL to absolute
 */
function resolveURL(href: string, baseUrl: string): string | null {
  try {
    // Skip non-http protocols
    if (href.startsWith('mailto:') || 
        href.startsWith('tel:') || 
        href.startsWith('javascript:') ||
        href.startsWith('#')) {
      return null;
    }

    const absolute = new URL(href, baseUrl);
    
    // Skip non-HTML resources
    const ext = absolute.pathname.split('.').pop()?.toLowerCase();
    const skipExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'mp4', 'mp3', 'zip', 'exe', 'dmg'];
    if (ext && skipExtensions.includes(ext)) {
      return null;
    }

    return absolute.href;
  } catch (error) {
    return null;
  }
}

/**
 * Check if URL is from the same domain
 */
function isSameDomain(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === baseDomain || parsed.hostname.endsWith('.' + baseDomain);
  } catch (error) {
    return false;
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}