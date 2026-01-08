// lib/knowledge/tableProcessor.ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

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

export async function processFile(file: File): Promise<ProcessedFile> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const fileName = file.name;
    const fileSize = file.size;
    const fileType = file.type || `application/${fileExtension}`;

    let content = '';
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
          metadata.rowCount = await getCSVRowCount(buffer);
          break;

        case 'pdf':
          console.log("Processing PDF with pdf2json...");
          const pdfResult = await extractTextFromPDF(buffer);
          content = pdfResult.text;
          metadata.pageCount = pdfResult.pages || 1;
          metadata.pdfInfo = pdfResult.info || {};
          metadata.textStats = {
            numSpaces: content.split(' ').length - 1,
            numPages: pdfResult.pages || 1,
            success: pdfResult.success,
          };
          break;

        case 'doc':
        case 'docx':
          const docResult = await mammoth.extractRawText({ buffer });
          content = docResult.value;
          metadata.pageCount = Math.ceil(content.length / 1500);
          metadata.hasImages = docResult.messages.some(msg => msg.type === 'warning');
          break;

        case 'xls':
        case 'xlsx':
          const excelResult = await extractTextFromExcel(buffer, fileName);
          content = excelResult.content;
          metadata.sheetCount = excelResult.sheetCount;
          metadata.sheetNames = excelResult.sheetNames;
          metadata.hasFormulas = excelResult.hasFormulas;
          metadata.rowCount = excelResult.totalRows;
          metadata.columnCount = excelResult.totalColumns;
          break;

        case 'ppt':
        case 'pptx':
          content = "Presentation file detected. For better results, convert to PDF or text format.";
          metadata.note = "PPT files require specialized processing. Consider converting to PDF.";
          break;

        default:
          try {
            content = buffer.toString('utf-8');
            if (content.length < 10) {
              throw new Error(`Unsupported file type or binary file: ${fileExtension}`);
            }
          } catch (error) {
            throw new Error(`Unsupported file type: ${fileExtension}. Please use PDF, DOC, TXT, CSV, or XLS files.`);
          }
      }
    } catch (error) {
      console.error("Error processing file:", error);
      throw new Error(`Failed to process file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    content = cleanContent(content);
    metadata.wordCount = countWords(content);
    metadata.characterCount = content.length;
    metadata.sentenceCount = countSentences(content);
    metadata.paragraphCount = countParagraphs(content);
    metadata.readingTimeMinutes = calculateReadingTime(content);

    return { content, metadata };
}

// PDF Text Extraction with pdf2json
async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string;
  pages: number;
  info: any;
  success: boolean;
}> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);
    
    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("PDF parsing error:", errData);
      reject(new Error(`PDF parsing failed: ${errData.parserError}`));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        let text = "";
        let pages = 0;
        
        if (pdfData && pdfData.Pages) {
          pages = pdfData.Pages.length;
          
          // Extract text from each page
          pdfData.Pages.forEach((page: any) => {
            if (page.Texts) {
              page.Texts.forEach((textObj: any) => {
                if (textObj.R && textObj.R[0]) {
                  // Decode URI encoded text
                  try {
                    const decodedText = decodeURIComponent(textObj.R[0].T || "");
                    text += decodedText + " ";
                  } catch (e) {
                    text += textObj.R[0].T + " ";
                  }
                }
              });
              text += "\n\n"; // Add spacing between pages
            }
          });
        }
        
        resolve({
          text: text.trim(),
          pages,
          info: pdfData.Meta || {},
          success: true,
        });
      } catch (error) {
        reject(new Error(`Failed to process PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });

    try {
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      reject(new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

async function extractTextFromCSV(buffer: Buffer): Promise<string> {
  const text = buffer.toString('utf-8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        let content = '';
        
        if (results.meta.fields && results.meta.fields.length > 0) {
          content += `Columns: ${results.meta.fields.join(', ')}\n\n`;
        }
        
        rows.forEach((row, index) => {
          content += `Row ${index + 1}:\n`;
          Object.entries(row).forEach(([key, value]) => {
            content += `  ${key}: ${value}\n`;
          });
          content += '\n';
        });
        
        resolve(content);
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

async function getCSVRowCount(buffer: Buffer): Promise<number> {
  const text = buffer.toString('utf-8');
  
  return new Promise((resolve) => {
    Papa.parse(text, {
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data.length);
      },
      error: () => {
        resolve(0);
      },
    });
  });
}

async function extractTextFromExcel(buffer: Buffer, fileName: string): Promise<{
  content: string;
  sheetCount: number;
  sheetNames: string[];
  hasFormulas: boolean;
  totalRows: number;
  totalColumns: number;
}> {
  try {
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellFormula: true,
    });
    
    const sheetNames = workbook.SheetNames;
    let content = '';
    let totalRows = 0;
    let totalColumns = 0;
    let hasFormulas = false;
    
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      content += `Sheet: ${sheetName}\n`;
      content += `Range: ${XLSX.utils.encode_range(range)}\n\n`;
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (!hasFormulas) {
        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            if (cell && cell.f) {
              hasFormulas = true;
              break;
            }
          }
          if (hasFormulas) break;
        }
      }
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        content += `Row ${i + 1}: ${row.join(' | ')}\n`;
      }
      
      content += '\n---\n\n';
      totalRows += jsonData.length;
      totalColumns = Math.max(totalColumns, range.e.c + 1);
    }
    
    return {
      content,
      sheetCount: sheetNames.length,
      sheetNames,
      hasFormulas,
      totalRows,
      totalColumns,
    };
  } catch (error) {
    throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function cleanContent(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t+/g, ' ')
    .replace(/[ \u00A0]{2,}/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0).length;
}

function calculateReadingTime(text: string, wordsPerMinute: number = 200): number {
  const wordCount = countWords(text);
  return Math.ceil(wordCount / wordsPerMinute);
}

export function chunkContent(
  content: string,
  maxChunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph.trim());
    } else {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        const sentenceWithSpace = sentence.trim();
        if (sentenceWithSpace.length === 0) continue;
        
        if ((currentChunk + ' ' + sentenceWithSpace).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(overlap / 5));
          currentChunk = overlapWords.join(' ') + ' ' + sentenceWithSpace;
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + sentenceWithSpace : sentenceWithSpace;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  
  return chunks.length > 0 ? chunks : [];
}

// Rest of your table processing functions...
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
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const fileName = file.name;
  const fileType = file.type || `application/${fileExtension}`;
  
  let result: ProcessedTable;
  
  switch (fileExtension) {
    case 'csv':
      result = await processCSV(file);
      break;
    case 'xls':
    case 'xlsx':
      result = await processExcelFile(file);
      break;
    case 'sql':
      result = await processSQL(file);
      break;
    default:
      throw new Error(`Unsupported table file type: ${fileExtension}`);
  }
  
  result.metadata.fileName = fileName;
  result.metadata.fileType = fileType;
  result.metadata.fileSize = file.size;
  result.metadata.extractedAt = new Date().toISOString();
  
  return result;
}

async function processCSV(file: File): Promise<ProcessedTable> {
  const text = await file.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      transform: (value: string, field: string | number) => {
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      },
      complete: (results) => {
        const rows = results.data as any[];
        const columns = results.meta.fields || [];
        
        const cleanColumns = columns.map(col => 
          col.trim().replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ')
        );
        
        resolve({
          rows,
          metadata: {
            rowCount: rows.length,
            columnCount: columns.length,
            columns: cleanColumns,
            tableName: file.name.replace(/\.[^/.]+$/, ''),
            delimiter: results.meta.delimiter,
            lineBreak: results.meta.linebreak,
            hasErrors: results.errors.length > 0,
            errors: results.errors,
          },
        });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

async function processExcelFile(file: File): Promise<ProcessedTable> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { 
    type: 'array',
    cellDates: true,
    cellFormula: true,
  });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    defval: null,
    raw: false,
    header: 1,
  });
  
  if (rows.length === 0) {
    throw new Error('Excel file is empty or cannot be read');
  }
  
  const headers = rows[0] as any[];
  const dataRows = rows.slice(1) as any[][];
  
  const jsonRows = dataRows.map(row => {
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header || `Column_${index + 1}`] = row[index] || null;
    });
    return obj;
  });
  
  const cleanColumns = headers.map(header => 
    (header?.toString() || '').trim().replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ')
  ).filter(header => header.length > 0);
  
  return {
    rows: jsonRows,
    metadata: {
      rowCount: jsonRows.length,
      columnCount: cleanColumns.length,
      columns: cleanColumns,
      tableName: sheetName,
      sheetNames: workbook.SheetNames,
      totalSheets: workbook.SheetNames.length,
      dimensions: {
        rows: range.e.r + 1,
        columns: range.e.c + 1,
      },
    },
  };
}

async function processSQL(file: File): Promise<ProcessedTable> {
  console.log("Processing SQL file...");
  const text = await file.text();
  
  const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  const insertRegex = /INSERT INTO\s+`?(\w+)`?\s*(?:\((.*?)\))?\s*VALUES\s*([\s\S]*?);/gi;
  
  const tables: Map<string, { columns: string[], rows: any[] }> = new Map();
  
  let match;
  while ((match = createTableRegex.exec(text)) !== null) {
    const tableName = match[1];
    const columnDefs = match[2];
    
    const columns = columnDefs
      .split(',')
      .map(def => {
        const colMatch = def.trim().match(/^`?(\w+)`?/);
        return colMatch ? colMatch[1] : null;
      })
      .filter(Boolean) as string[];
    
    tables.set(tableName, { columns, rows: [] });
  }
  
  while ((match = insertRegex.exec(text)) !== null) {
    const tableName = match[1];
    const columnList = match[2];
    const valuesAllStr = match[3];
    
    const table = tables.get(tableName);
    if (!table) continue;
    
    const columns = columnList 
      ? columnList.split(',').map(c => c.trim().replace(/`/g, ''))
      : table.columns;

    // Handle multiple value sets: (val1, val2), (val3, val4)
    const rowStrings: string[] = [];
    let currentBarcketContent = '';
    let bracketDepth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < valuesAllStr.length; i++) {
      const char = valuesAllStr[i];
      
      if ((char === '"' || char === "'") && valuesAllStr[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
      }

      if (!inQuotes) {
        if (char === '(') {
          bracketDepth++;
          if (bracketDepth === 1) {
            currentBarcketContent = '';
            continue;
          }
        } else if (char === ')') {
          bracketDepth--;
          if (bracketDepth === 0) {
            rowStrings.push(currentBarcketContent);
          }
        }
      }

      if (bracketDepth > 0) {
        currentBarcketContent += char;
      }
    }

    for (const valuesStr of rowStrings) {
      const values = parseValues(valuesStr);
      const row: any = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx];
      });
      table.rows.push(row);
    }
  }
  
  const allRows: any[] = [];
  const allColumns = new Set<string>();
  const tableNames: string[] = [];
  
  tables.forEach((table, tableName) => {
    tableNames.push(tableName);
    console.log("Table:", table);
    table.columns.forEach(col => allColumns.add(col));
    
    table.rows.forEach(row => {
      console.log("Row:", row);
      allRows.push({ 
        _table: tableName, 
        ...row 
      });
    });
  });

  console.log(tables);
 
  console.log("Finished processing SQL file.");

  return {
    rows: allRows,
    metadata: {
      rowCount: allRows.length,
      columnCount: allColumns.size,
      columns: Array.from(allColumns),
      tables: tableNames,
      totalTables: tableNames.length,
    },
  };
}

function parseValues(valuesStr: string): any[] {
  const values: any[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    
    if ((char === '"' || char === "'") && valuesStr[i - 1] !== '\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else {
        current += char;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(parseValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    values.push(parseValue(current.trim()));
  }
  
  return values;
}

function parseValue(value: string): any {
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  
  if (value.toUpperCase() === 'NULL') {
    return null;
  }
  
  if (value.toUpperCase() === 'TRUE' || value.toUpperCase() === 'FALSE') {
    return value.toUpperCase() === 'TRUE';
  }
  
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }
  
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(value)) {
    return value;
  }
  
  return value;
}

export function getFileInfo(file: File): {
  extension: string;
  type: string;
  isText: boolean;
  isImage: boolean;
  isDocument: boolean;
  isSpreadsheet: boolean;
  isPresentation: boolean;
} {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const type = file.type || '';
  
  const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const documentExtensions = ['pdf', 'doc', 'docx', 'rtf'];
  const spreadsheetExtensions = ['xls', 'xlsx', 'ods'];
  const presentationExtensions = ['ppt', 'pptx', 'odp'];
  
  return {
    extension,
    type,
    isText: textExtensions.includes(extension),
    isImage: imageExtensions.includes(extension),
    isDocument: documentExtensions.includes(extension),
    isSpreadsheet: spreadsheetExtensions.includes(extension),
    isPresentation: presentationExtensions.includes(extension),
  };
}