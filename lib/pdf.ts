'use client';

import type { OcrLine, PageImage } from './types';

const TARGET_WIDTH = 1600; // ~200 DPI on A4

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return lib;
    });
  }
  return pdfjsLibPromise;
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Rasterizes a PDF or image file into one JPEG data URL per page, at a consistent width. */
export async function rasterizeFile(file: File): Promise<PageImage[]> {
  if (IMAGE_MIME_TYPES.has(file.type)) {
    return [await rasterizeImageFile(file)];
  }
  return rasterizePdfFile(file);
}

async function rasterizeImageFile(file: File): Promise<PageImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const scale = TARGET_WIDTH / img.width;
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_WIDTH;
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return {
    index: 0,
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width: canvas.width,
    height: canvas.height,
  };
}

async function rasterizePdfFile(file: File): Promise<PageImage[]> {
  const pdfjsLib = await getPdfjs();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

  const pages: PageImage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    // @ts-expect-error -- pdf.js typings want a Canvas element specifically
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      index: n - 1,
      dataUrl: canvas.toDataURL('image/jpeg', 0.85),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return pages;
}

export type AnswerPageResult = {
  page: PageImage;
  /** Lines built straight from the PDF's own text layer, with real positions — null if this page
   * has no meaningful text layer (a scan/photo) and needs OCR instead. */
  textLines: OcrLine[] | null;
};

const MIN_CHARS_FOR_TEXT_LAYER = 40;

/**
 * Rasterizes the answer sheet AND, per page, extracts line-level text
 * straight from the PDF's text layer when one exists — e.g. a digitally
 * typed answer sheet exported to PDF. That skips OCR (and its cost/latency)
 * entirely for such pages; only pages that are actually scans/photos (no
 * usable text layer) fall back to OCR.
 */
export async function rasterizeAnswerSheet(file: File): Promise<AnswerPageResult[]> {
  if (IMAGE_MIME_TYPES.has(file.type)) {
    return [{ page: await rasterizeImageFile(file), textLines: null }];
  }

  const pdfjsLib = await getPdfjs();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

  const results: AnswerPageResult[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    // @ts-expect-error -- pdf.js typings want a Canvas element specifically
    await page.render({ canvasContext: ctx, viewport }).promise;

    const pageImage: PageImage = {
      index: n - 1,
      dataUrl: canvas.toDataURL('image/jpeg', 0.85),
      width: canvas.width,
      height: canvas.height,
    };

    const content = await page.getTextContent();
    const totalChars = content.items.reduce((sum, item) => sum + ('str' in item ? item.str.length : 0), 0);
    const textLines =
      totalChars > MIN_CHARS_FOR_TEXT_LAYER
        ? buildLinesFromTextContent(pdfjsLib, content.items, viewport, n - 1, pageImage.width, pageImage.height)
        : null;

    results.push({ page: pageImage, textLines });
  }
  return results;
}

type PositionedItem = { text: string; x: number; y: number; w: number; h: number };

function buildLinesFromTextContent(
  pdfjsLib: Awaited<ReturnType<typeof getPdfjs>>,
  items: Awaited<ReturnType<import('pdfjs-dist').PDFPageProxy['getTextContent']>>['items'],
  viewport: import('pdfjs-dist').PageViewport,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
): OcrLine[] {
  const positioned: PositionedItem[] = [];
  // item.width/height come back from pdf.js already in PDF-point space (font
  // size baked in), so they only need the viewport's own scalar applied —
  // scaling by hypot(tx) as well would double-count the font-size scaling
  // that's already inside item.transform (verified against a synthetic PDF:
  // that bug produced line widths of 600%+ of the page).
  const viewportScale = viewport.scale;
  for (const item of items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const w = item.width * viewportScale;
    const h = item.height * viewportScale;
    positioned.push({ text: item.str, x: tx[4], y: tx[5] - h, w, h });
  }

  positioned.sort((a, b) => a.y - b.y || a.x - b.x);

  const rawLines: { y0: number; y1: number; items: PositionedItem[] }[] = [];
  for (const item of positioned) {
    const mid = item.y + item.h / 2;
    const last = rawLines.at(-1);
    if (last && mid >= last.y0 && mid <= last.y1) {
      last.items.push(item);
      last.y0 = Math.min(last.y0, item.y);
      last.y1 = Math.max(last.y1, item.y + item.h);
    } else {
      rawLines.push({ y0: item.y, y1: item.y + item.h, items: [item] });
    }
  }

  return rawLines
    .map((line, i) => {
      const sorted = [...line.items].sort((a, b) => a.x - b.x);
      const x0 = Math.min(...sorted.map((it) => it.x));
      const x1 = Math.max(...sorted.map((it) => it.x + it.w));
      return {
        id: `p${pageIndex}_l${i}`,
        page: pageIndex,
        text: sorted
          .map((it) => it.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
        box: {
          x: (x0 / pageWidth) * 100,
          y: (line.y0 / pageHeight) * 100,
          w: ((x1 - x0) / pageWidth) * 100,
          h: ((line.y1 - line.y0) / pageHeight) * 100,
        },
      };
    })
    .filter((l) => l.text.length > 0);
}

/** Extracts the raw text layer of a PDF, per page. Returns null for image-only files/PDFs. */
export async function extractTextLayer(file: File): Promise<string[] | null> {
  if (IMAGE_MIME_TYPES.has(file.type)) return null;

  const pdfjsLib = await getPdfjs();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

  const pageTexts: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(text);
  }
  return pageTexts;
}
