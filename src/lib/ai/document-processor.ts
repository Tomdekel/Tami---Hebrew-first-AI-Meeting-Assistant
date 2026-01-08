import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { generateEmbeddings, type EmbeddingResult } from "./embeddings";

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  sheetName?: string;
}

export interface ProcessedDocument {
  chunks: DocumentChunk[];
  totalChunks: number;
  extractedText: string;
  metadata: {
    pageCount?: number;
    sheetNames?: string[];
    wordCount: number;
  };
}

export interface DocumentEmbedding {
  content: string;
  embedding: number[];
  chunkIndex: number;
  metadata: {
    pageNumber?: number;
    sheetName?: string;
  };
}

const MAX_CHUNK_LENGTH = 2000; // ~500 tokens
const CHUNK_OVERLAP = 200; // Overlap between chunks for context continuity

/**
 * Extract text from a PDF file
 */
async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  const infoResult = await parser.getInfo();
  await parser.destroy();

  return {
    text: textResult.text,
    pageCount: infoResult.total,
  };
}

/**
 * Extract text from a Word document (.docx)
 */
async function extractTextFromWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from an Excel file (.xlsx, .xls)
 */
function extractTextFromExcel(buffer: Buffer): {
  text: string;
  sheetNames: string[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;
  const texts: string[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const text = XLSX.utils.sheet_to_txt(sheet);
    if (text.trim()) {
      texts.push(`[${sheetName}]\n${text}`);
    }
  }

  return {
    text: texts.join("\n\n"),
    sheetNames,
  };
}

/**
 * Chunk text into smaller segments with overlap
 */
function chunkText(text: string): string[] {
  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleanedText.length <= MAX_CHUNK_LENGTH) {
    return [cleanedText];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + MAX_CHUNK_LENGTH;

    // If not at the end, try to find a good break point
    if (endIndex < cleanedText.length) {
      // Look for paragraph break first
      const paragraphBreak = cleanedText.lastIndexOf("\n\n", endIndex);
      if (paragraphBreak > startIndex + MAX_CHUNK_LENGTH / 2) {
        endIndex = paragraphBreak;
      } else {
        // Look for sentence break
        const sentenceBreak = cleanedText.lastIndexOf(". ", endIndex);
        if (sentenceBreak > startIndex + MAX_CHUNK_LENGTH / 2) {
          endIndex = sentenceBreak + 1;
        } else {
          // Look for word break
          const wordBreak = cleanedText.lastIndexOf(" ", endIndex);
          if (wordBreak > startIndex) {
            endIndex = wordBreak;
          }
        }
      }
    }

    const chunk = cleanedText.slice(startIndex, endIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Move to next chunk with overlap
    startIndex = endIndex - CHUNK_OVERLAP;
    if (startIndex < 0) startIndex = endIndex;
  }

  return chunks;
}

/**
 * Process a document and extract chunked text
 */
export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ProcessedDocument> {
  let extractedText = "";
  let metadata: ProcessedDocument["metadata"] = { wordCount: 0 };

  // Extract text based on file type
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    const { text, pageCount } = await extractTextFromPDF(buffer);
    extractedText = text;
    metadata.pageCount = pageCount;
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    filename.toLowerCase().endsWith(".docx") ||
    filename.toLowerCase().endsWith(".doc")
  ) {
    extractedText = await extractTextFromWord(buffer);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    filename.toLowerCase().endsWith(".xlsx") ||
    filename.toLowerCase().endsWith(".xls")
  ) {
    const { text, sheetNames } = extractTextFromExcel(buffer);
    extractedText = text;
    metadata.sheetNames = sheetNames;
  } else if (mimeType === "text/plain" || filename.toLowerCase().endsWith(".txt")) {
    extractedText = buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // Calculate word count
  metadata.wordCount = extractedText.split(/\s+/).filter(Boolean).length;

  // Chunk the text
  const textChunks = chunkText(extractedText);

  const chunks: DocumentChunk[] = textChunks.map((content, index) => ({
    content,
    chunkIndex: index,
  }));

  return {
    chunks,
    totalChunks: chunks.length,
    extractedText,
    metadata,
  };
}

/**
 * Process a document and generate embeddings for each chunk
 */
export async function processDocumentWithEmbeddings(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{
  embeddings: DocumentEmbedding[];
  metadata: ProcessedDocument["metadata"];
}> {
  const processed = await processDocument(buffer, mimeType, filename);

  if (processed.chunks.length === 0) {
    return {
      embeddings: [],
      metadata: processed.metadata,
    };
  }

  // Generate embeddings for all chunks
  const embeddingResults: EmbeddingResult[] = await generateEmbeddings(
    processed.chunks.map((c) => c.content)
  );

  const embeddings: DocumentEmbedding[] = processed.chunks.map((chunk, index) => ({
    content: chunk.content,
    embedding: embeddingResults[index].embedding,
    chunkIndex: chunk.chunkIndex,
    metadata: {
      pageNumber: chunk.pageNumber,
      sheetName: chunk.sheetName,
    },
  }));

  return {
    embeddings,
    metadata: processed.metadata,
  };
}

/**
 * Check if a file type is supported for document processing
 */
export function isSupportedDocumentType(mimeType: string, filename: string): boolean {
  const supportedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/plain",
  ];

  const supportedExtensions = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt"];

  const lowerFilename = filename.toLowerCase();

  return (
    supportedMimes.includes(mimeType) ||
    supportedExtensions.some((ext) => lowerFilename.endsWith(ext))
  );
}
