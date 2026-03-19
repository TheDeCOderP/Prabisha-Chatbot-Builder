// lib/knowledge/tableProcessor.ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { GoogleGenAI } from '@google/genai';

// ─── Gemini client (@google/genai) ───────────────────────────────────────────
//
// Using @google/genai (the newer SDK) instead of @google/generative-ai.
// The API surface is slightly different:
//   - new GoogleGenAI({ apiKey })   instead of new GoogleGenerativeAI(key)
//   - ai.models.generateContent()  instead of model.generateContent()

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedFile {
  content: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    extractedAt: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    [key: string]: any;
  };
}

/**
 * A single embeddable chunk produced from a PDF.
 *
 * Strategy: per-page extraction via Gemini, then each page is split into
 * overlapping chunks so no single vector exceeds the embedding model's token
 * limit (~8k tokens / ~6k words) while preserving cross-sentence context.
 *
 * Why not one vector per document?
 *   → Retrieval precision collapses on long PDFs. A question about page 8 of a
 *     50-page manual would surface the entire document; the relevant passage
 *     gets drowned out by irrelevant content.
 *
 * Why not one vector per page?
 *   → Pages can still be too long for most embedding models, and a sentence
 *     split across a page boundary loses context.
 *
 * Why per-page chunks with overlap?
 *   → Each chunk is short enough to embed accurately, the overlap (100 words)
 *     prevents context loss at boundaries, and the metadata (page, chunkIndex,
 *     totalChunks) lets you cite the exact source location.
 */
export interface PDFChunk {
  /** Zero-based page index */
  page: number;
  /** Zero-based chunk index within this page */
  chunkIndex: number;
  /** Total chunks on this page */
  totalChunksOnPage: number;
  /** Total pages in the PDF */
  totalPages: number;
  /** The text content to embed */
  content: string;
  /** Brief summary Gemini produced for image-heavy pages */
  pageContext?: string;
}

export interface ProcessedPDF {
  /** All chunks — one entry per vector to store */
  chunks: PDFChunk[];
  /** Full concatenated text (used for word-count, parent doc storage, etc.) */
  fullText: string;
  metadata: {
    pageCount: number;
    wordCount: number;
    extractedAt: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    chunkCount: number;
    extractionMethod: 'gemini';
  };
}

// ─── Chunk constants ──────────────────────────────────────────────────────────

const CHUNK_WORD_LIMIT = 800; // target words per chunk
const CHUNK_OVERLAP    = 100; // words of overlap between adjacent chunks

// ─── chunkPageText ────────────────────────────────────────────────────────────

function chunkPageText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) return [];
  if (words.length <= CHUNK_WORD_LIMIT) return [text.trim()];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_WORD_LIMIT, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += CHUNK_WORD_LIMIT - CHUNK_OVERLAP;
    if (words.length - start <= CHUNK_OVERLAP) break;
  }

  // Ensure the final tail is always captured.
  const lastChunk = words.slice(Math.max(0, words.length - CHUNK_WORD_LIMIT)).join(' ');
  if (chunks[chunks.length - 1] !== lastChunk && lastChunk.trim()) {
    chunks.push(lastChunk);
  }

  return chunks;
}

// ─── extractPDFWithGemini ─────────────────────────────────────────────────────
//
// Uses @google/genai with gemini-2.0-flash.
// The PDF is sent as an inline base64 blob — Gemini natively understands PDFs
// and returns structured per-page JSON in a single round-trip.

export async function extractTextFromPDF(file: File): Promise<ProcessedPDF> {
  const fileName    = file.name;
  const fileSize    = file.size;
  const fileType    = file.type || 'application/pdf';
  const arrayBuffer = await file.arrayBuffer();
  const base64Data  = Buffer.from(arrayBuffer).toString('base64');

  const extractionPrompt = `
You are a document extraction assistant. Extract the text content from this PDF.

Return a JSON array where each element represents ONE page:

[
  {
    "page": 1,
    "content": "Full readable text of the page, preserving paragraphs and structure",
    "pageContext": "Optional brief summary if the page contains mostly tables/images"
  }
]

Rules:
- "page" is 1-based.
- "content" must contain ALL readable text on that page — headings, body text, list items, table cell values. Do NOT truncate.
- For pages that are mostly images with little text, describe the visual content in "content".
- For tables, convert them to readable prose: "Column A: val1, Column B: val2".
- Preserve paragraph breaks with \\n\\n.
- Return ONLY the raw JSON array. No markdown fences, no explanation.
`.trim();

  let geminiPages: Array<{ page: number; content: string; pageContext?: string }>;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            // Inline PDF blob — same pattern as resume-parser.ts uses for images
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            { text: extractionPrompt },
          ],
        },
      ],
    });

    // @google/genai returns response.text directly (no .response wrapper)
    const rawText = (response.text ?? '').replace(/```json|```/g, '').trim();

    if (!rawText) {
      throw new Error('Gemini returned an empty response');
    }

    geminiPages = JSON.parse(rawText);

    if (!Array.isArray(geminiPages)) {
      throw new Error('Gemini did not return a JSON array');
    }
  } catch (err) {
    throw new Error(
      `Gemini PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Build chunks ──────────────────────────────────────────────────────────

  const totalPages = geminiPages.length;
  const allChunks: PDFChunk[] = [];
  let fullText = '';

  for (const geminiPage of geminiPages) {
    const pageText = (geminiPage.content || '').trim();
    if (!pageText) continue;

    fullText += pageText + '\n\n';

    const pageChunks = chunkPageText(pageText);

    pageChunks.forEach((chunkText, chunkIdx) => {
      allChunks.push({
        page:              geminiPage.page - 1, // 0-based internally
        chunkIndex:        chunkIdx,
        totalChunksOnPage: pageChunks.length,
        totalPages,
        content:           chunkText,
        pageContext:       geminiPage.pageContext,
      });
    });
  }

  if (allChunks.length === 0) {
    throw new Error('No text could be extracted from this PDF.');
  }

  return {
    chunks: allChunks,
    fullText: fullText.trim(),
    metadata: {
      pageCount:        totalPages,
      wordCount:        countWords(fullText),
      extractedAt:      new Date().toISOString(),
      fileName,
      fileType,
      fileSize,
      chunkCount:       allChunks.length,
      extractionMethod: 'gemini',
    },
  };
}

// ─── processFile ─────────────────────────────────────────────────────────────
//
// For non-PDF files returns a single ProcessedFile (unchanged behaviour).
// For PDFs it delegates to extractPDFWithGemini and collapses to fullText so
// the rest of the codebase that only needs a single string still works.
// Callers wanting per-page vectors should use extractPDFWithGemini() directly.

export async function processFile(file: File): Promise<ProcessedFile> {
  const buffer        = Buffer.from(await file.arrayBuffer());
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const fileName      = file.name;
  const fileSize      = file.size;
  const fileType      = file.type || `application/${fileExtension}`;

  let content  = '';
  let metadata: any = {
    extractedAt: new Date().toISOString(),
    fileName,
    fileType,
    fileSize,
    fileExtension,
  };

  try {
    switch (fileExtension) {
      case 'txt':
        content = buffer.toString('utf-8');
        metadata.pageCount = 1;
        metadata.lineCount = content.split('\n').length;
        break;

      case 'csv':
        content = await extractTextFromCSV(buffer);
        metadata.pageCount = 1;
        metadata.rowCount  = await getCSVRowCount(buffer);
        break;

      case 'pdf': {
        const pdf = await extractTextFromPDF(file);
        content = pdf.fullText;
        metadata.pageCount        = pdf.metadata.pageCount;
        metadata.chunkCount       = pdf.metadata.chunkCount;
        metadata.extractionMethod = 'gemini';
        break;
      }

      case 'doc':
      case 'docx': {
        const docResult = await mammoth.extractRawText({ buffer });
        content = docResult.value;
        metadata.pageCount = Math.ceil(content.length / 1500);
        metadata.hasImages = docResult.messages.some(m => m.type === 'warning');
        break;
      }

      case 'xls':
      case 'xlsx': {
        const excelResult = await extractTextFromExcel(buffer, fileName);
        content = excelResult.content;
        metadata.sheetCount  = excelResult.sheetCount;
        metadata.sheetNames  = excelResult.sheetNames;
        metadata.hasFormulas = excelResult.hasFormulas;
        metadata.rowCount    = excelResult.totalRows;
        metadata.columnCount = excelResult.totalColumns;
        break;
      }

      case 'ppt':
      case 'pptx':
        content = 'Presentation file detected. For better results, convert to PDF or text format.';
        metadata.note = 'PPT files require specialised processing. Consider converting to PDF.';
        break;

      default:
        try {
          content = buffer.toString('utf-8');
          if (content.length < 10) throw new Error(`Unsupported file type or binary: ${fileExtension}`);
        } catch {
          throw new Error(
            `Unsupported file type: ${fileExtension}. Please use PDF, DOC, TXT, CSV, or XLS files.`
          );
        }
    }
  } catch (error) {
    console.error('Error processing file:', error);
    throw new Error(
      `Failed to process file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  content = cleanContent(content);
  metadata.wordCount          = countWords(content);
  metadata.characterCount     = content.length;
  metadata.sentenceCount      = countSentences(content);
  metadata.paragraphCount     = countParagraphs(content);
  metadata.readingTimeMinutes = calculateReadingTime(content);

  return { content, metadata };
}

// ─── Non-PDF file helpers (unchanged) ────────────────────────────────────────

async function extractTextFromCSV(buffer: Buffer): Promise<string> {
  const text = buffer.toString('utf-8');
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        let content = '';
        if (results.meta.fields?.length) {
          content += `Columns: ${results.meta.fields.join(', ')}\n\n`;
        }
        rows.forEach((row, i) => {
          content += `Row ${i + 1}:\n`;
          Object.entries(row).forEach(([k, v]) => { content += `  ${k}: ${v}\n`; });
          content += '\n';
        });
        resolve(content);
      },
      error: (err: Error) => reject(new Error(`CSV parsing error: ${err.message}`)),
    });
  });
}

async function getCSVRowCount(buffer: Buffer): Promise<number> {
  const text = buffer.toString('utf-8');
  return new Promise((resolve) => {
    Papa.parse(text, {
      skipEmptyLines: true,
      complete: (r) => resolve(r.data.length),
      error: () => resolve(0),
    });
  });
}

async function extractTextFromExcel(buffer: Buffer, _fileName: string): Promise<{
  content: string;
  sheetCount: number;
  sheetNames: string[];
  hasFormulas: boolean;
  totalRows: number;
  totalColumns: number;
}> {
  const workbook   = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
  const sheetNames = workbook.SheetNames;
  let content = '', totalRows = 0, totalColumns = 0, hasFormulas = false;

  for (const sheetName of sheetNames) {
    const ws    = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    content += `Sheet: ${sheetName}\nRange: ${XLSX.utils.encode_range(range)}\n\n`;

    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (!hasFormulas) {
      outer: for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          if (ws[XLSX.utils.encode_cell({ r, c })]?.f) { hasFormulas = true; break outer; }
        }
      }
    }

    jsonData.forEach((row, i) => {
      content += `Row ${i + 1}: ${(row as any[]).join(' | ')}\n`;
    });
    content += '\n---\n\n';
    totalRows    += jsonData.length;
    totalColumns  = Math.max(totalColumns, range.e.c + 1);
  }

  return { content, sheetCount: sheetNames.length, sheetNames, hasFormulas, totalRows, totalColumns };
}

function cleanContent(text: string): string {
  return text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n').replace(/\t+/g, ' ')
    .replace(/[ \u00A0]{2,}/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\S\n]+/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
}

function calculateReadingTime(text: string, wpm = 200): number {
  return Math.ceil(countWords(text) / wpm);
}

export function chunkContent(content: string, maxChunkSize = 1000, overlap = 200): string[] {
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph.trim());
    } else {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let current = '';
      for (const s of sentences) {
        const sentence = s.trim();
        if (!sentence) continue;
        if ((current + ' ' + sentence).length > maxChunkSize && current.length > 0) {
          chunks.push(current.trim());
          const words = current.split(' ');
          current = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence;
        } else {
          current = current ? current + ' ' + sentence : sentence;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks.length > 0 ? chunks : [];
}

// ─── Table processing (unchanged) ────────────────────────────────────────────

export interface ProcessedTable {
  rows: any[];
  metadata: {
    rowCount: number;
    columnCount: number;
    columns: string[];
    tableName?: string;
    tables?: string[];
    fileName?: string;
    fileType?: string;
    [key: string]: any;
  };
}

export async function processTable(file: File): Promise<ProcessedTable> {
  const ext      = file.name.split('.').pop()?.toLowerCase();
  const fileName = file.name;
  const fileType = file.type || `application/${ext}`;

  let result: ProcessedTable;
  switch (ext) {
    case 'csv':  result = await processCSV(file);         break;
    case 'xls':
    case 'xlsx': result = await processExcelFile(file);   break;
    case 'sql':  result = await processSQL(file);         break;
    default: throw new Error(`Unsupported table file type: ${ext}`);
  }

  result.metadata.fileName    = fileName;
  result.metadata.fileType    = fileType;
  result.metadata.fileSize    = file.size;
  result.metadata.extractedAt = new Date().toISOString();
  return result;
}

async function processCSV(file: File): Promise<ProcessedTable> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      transform: (v: string) => (typeof v === 'string' ? v.trim() : v),
      complete: (results) => {
        const rows    = results.data as any[];
        const columns = results.meta.fields || [];
        resolve({
          rows,
          metadata: {
            rowCount:    rows.length,
            columnCount: columns.length,
            columns:     columns.map(c => c.trim().replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ')),
            tableName:   file.name.replace(/\.[^/.]+$/, ''),
            delimiter:   results.meta.delimiter,
            hasErrors:   results.errors.length > 0,
          },
        });
      },
      error: (err: Error) => reject(new Error(`CSV parsing error: ${err.message}`)),
    });
  });
}

async function processExcelFile(file: File): Promise<ProcessedTable> {
  const buffer   = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellFormula: true });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const range    = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, header: 1 });

  if (rows.length === 0) throw new Error('Excel file is empty');

  const headers  = rows[0] as any[];
  const jsonRows = (rows.slice(1) as any[][]).map(row => {
    const obj: any = {};
    headers.forEach((h, i) => { obj[h || `Column_${i + 1}`] = row[i] ?? null; });
    return obj;
  });
  const cleanCols = headers
    .map(h => (h?.toString() || '').trim().replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' '))
    .filter(h => h.length > 0);

  return {
    rows: jsonRows,
    metadata: {
      rowCount: jsonRows.length, columnCount: cleanCols.length, columns: cleanCols,
      tableName: workbook.SheetNames[0], sheetNames: workbook.SheetNames,
      dimensions: { rows: range.e.r + 1, columns: range.e.c + 1 },
    },
  };
}

async function processSQL(file: File): Promise<ProcessedTable> {
  const text             = await file.text();
  const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  const insertRegex      = /INSERT INTO\s+`?(\w+)`?\s*(?:\((.*?)\))?\s*VALUES\s*([\s\S]*?);/gi;
  const tables: Map<string, { columns: string[]; rows: any[] }> = new Map();

  let match;
  while ((match = createTableRegex.exec(text)) !== null) {
    const cols = match[2].split(',')
      .map(d => { const m = d.trim().match(/^`?(\w+)`?/); return m ? m[1] : null; })
      .filter(Boolean) as string[];
    tables.set(match[1], { columns: cols, rows: [] });
  }

  while ((match = insertRegex.exec(text)) !== null) {
    const table = tables.get(match[1]);
    if (!table) continue;
    const columns = match[2]
      ? match[2].split(',').map(c => c.trim().replace(/`/g, ''))
      : table.columns;

    const rowStrings: string[] = [];
    let buf = '', depth = 0, inQ = false, qChar = '';
    for (let i = 0; i < match[3].length; i++) {
      const ch = match[3][i];
      if ((ch === '"' || ch === "'") && match[3][i - 1] !== '\\') {
        if (!inQ) { inQ = true; qChar = ch; } else if (ch === qChar) { inQ = false; }
      }
      if (!inQ) {
        if (ch === '(') { depth++; if (depth === 1) { buf = ''; continue; } }
        else if (ch === ')') { depth--; if (depth === 0) rowStrings.push(buf); }
      }
      if (depth > 0) buf += ch;
    }

    for (const vs of rowStrings) {
      const vals = parseValues(vs);
      const row: any = {};
      columns.forEach((c, i) => { row[c] = vals[i]; });
      table.rows.push(row);
    }
  }

  const allRows: any[] = [];
  const allCols = new Set<string>();
  const tableNames: string[] = [];
  tables.forEach((t, name) => {
    tableNames.push(name);
    t.columns.forEach(c => allCols.add(c));
    t.rows.forEach(r => allRows.push({ _table: name, ...r }));
  });

  return {
    rows: allRows,
    metadata: {
      rowCount: allRows.length, columnCount: allCols.size,
      columns: Array.from(allCols), tables: tableNames, totalTables: tableNames.length,
    },
  };
}

function parseValues(str: string): any[] {
  const values: any[] = [];
  let current = '', inQ = false, qChar = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ((ch === '"' || ch === "'") && str[i - 1] !== '\\') {
      if (!inQ) { inQ = true; qChar = ch; }
      else if (ch === qChar) { inQ = false; qChar = ''; }
      else { current += ch; }
    } else if (ch === ',' && !inQ) {
      values.push(parseValue(current.trim())); current = '';
    } else { current += ch; }
  }
  if (current) values.push(parseValue(current.trim()));
  return values;
}

function parseValue(v: string): any {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    return v.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  if (v.toUpperCase() === 'NULL')  return null;
  if (v.toUpperCase() === 'TRUE')  return true;
  if (v.toUpperCase() === 'FALSE') return false;
  if (/^-?\d+(\.\d+)?$/.test(v))  return parseFloat(v);
  return v;
}

export function getFileInfo(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return {
    extension:      ext,
    type:           file.type || '',
    isText:         ['txt','csv','json','xml','html','htm','md'].includes(ext),
    isImage:        ['jpg','jpeg','png','gif','bmp','webp'].includes(ext),
    isDocument:     ['pdf','doc','docx','rtf'].includes(ext),
    isSpreadsheet:  ['xls','xlsx','ods'].includes(ext),
    isPresentation: ['ppt','pptx','odp'].includes(ext),
  };
}