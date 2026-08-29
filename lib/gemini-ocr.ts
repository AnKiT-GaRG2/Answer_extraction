import { Type } from '@google/genai';
import { dataUrlToPart, generateJson, type GeminiPart } from './gemini';
import type { OcrLine } from './types';

const OCR_INSTRUCTION = `You perform OCR on pages of a handwritten student exam answer sheet. You are
given one or more page images, in order; each image is immediately preceded by a text label
"Page N:", where N is that image's 0-based position among the images you were given (not necessarily
the sheet's true printed page number).

Rules:
- Identify every distinct line of handwritten text on each page, top to bottom, in reading order.
- Transcribe each line as accurately as possible, preserving the student's own wording. If a word is
  genuinely illegible, write "[illegible]" in its place rather than guessing.
- Ignore printed page furniture (ruled lines, margins, page numbers printed by the school) unless the
  student wrote on top of it.
- For each line, return "page": the 0-based index from that line's own "Page N:" label.
- For each line, also return its bounding box as box_2d: [yMin, xMin, yMax, xMax], four integers from
  0 to 1000, representing the box as a fraction of THAT page's own image height/width scaled by 1000,
  with (0, 0) at the top-left corner of that image. The box should tightly enclose just that one line
  of text.
- Two lines that are visually stacked (e.g. wrapped text) are still two separate lines with two boxes.
- Return lines for every page you were given, even a page with very little writing on it.`;

const OCR_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.INTEGER },
          text: { type: Type.STRING },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['page', 'text', 'box_2d'],
      },
    },
  },
  required: ['lines'],
};

type RawLine = { page: number; text: string; box_2d: number[] };

/**
 * OCRs a batch of page images in ONE Gemini call and returns line-level boxes
 * in percent-of-page coordinates. Batching pages (rather than one call per
 * page) matters because a free-tier key's binding limit is usually a small
 * *daily* request cap, not requests-per-minute — every call spent on OCR is
 * a call not available for grading.
 */
export async function ocrPagesWithGemini(pages: { pageIndex: number; dataUrl: string }[]): Promise<OcrLine[]> {
  const parts: GeminiPart[] = [];
  pages.forEach((p, i) => {
    parts.push({ text: `Page ${i}:` });
    parts.push(dataUrlToPart(p.dataUrl));
  });

  const { lines } = await generateJson<{ lines: RawLine[] }>({
    systemInstruction: OCR_INSTRUCTION,
    parts,
    schema: OCR_SCHEMA,
  });

  const lineCountByPage = new Map<number, number>();
  return lines
    .filter(
      (l) =>
        Array.isArray(l.box_2d) &&
        l.box_2d.length === 4 &&
        l.text.trim().length > 0 &&
        Number.isInteger(l.page) &&
        l.page >= 0 &&
        l.page < pages.length,
    )
    .map((l) => {
      const pageIndex = pages[l.page].pageIndex;
      const i = lineCountByPage.get(l.page) ?? 0;
      lineCountByPage.set(l.page, i + 1);
      const [yMin, xMin, yMax, xMax] = l.box_2d;
      return {
        id: `p${pageIndex}_l${i}`,
        page: pageIndex,
        text: l.text.trim(),
        box: {
          x: xMin / 10,
          y: yMin / 10,
          w: (xMax - xMin) / 10,
          h: (yMax - yMin) / 10,
        },
      };
    });
}
