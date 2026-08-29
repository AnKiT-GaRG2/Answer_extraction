import type { OcrLine, Region } from './types';

/**
 * Unions line boxes into one rectangle per contiguous run on a page. A new
 * region starts whenever the page changes or the vertical gap to the
 * previous line exceeds the tolerance — this is what makes multi-page
 * answers fall out for free as multiple regions.
 */
export function computeRegions(lineIds: string[], lineById: Map<string, OcrLine>): Region[] {
  const selected = lineIds
    .map((id) => lineById.get(id))
    .filter((l): l is OcrLine => Boolean(l))
    .sort((a, b) => a.page - b.page || a.box.y - b.box.y);

  const out: Region[] = [];
  for (const line of selected) {
    const prev = out.at(-1);
    const adjacent =
      prev !== undefined &&
      prev.page === line.page &&
      line.box.y - (prev.y + prev.h) < 3; // 3% gap tolerance

    if (prev && adjacent) {
      const x = Math.min(prev.x, line.box.x);
      const right = Math.max(prev.x + prev.w, line.box.x + line.box.w);
      const bottom = line.box.y + line.box.h;
      prev.x = x;
      prev.w = right - x;
      prev.h = bottom - prev.y;
    } else {
      out.push({ page: line.page, x: line.box.x, y: line.box.y, w: line.box.w, h: line.box.h });
    }
  }
  return out;
}
