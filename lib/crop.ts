import sharp from 'sharp';
import type { PageImage, Region } from './types';

const PAD_PCT = 1.5; // extra margin so diagram edges aren't clipped

/** Crops one region out of its page image and returns a JPEG data URL. */
export async function cropRegion(region: Region, page: PageImage): Promise<string> {
  const base64 = page.dataUrl.slice(page.dataUrl.indexOf(',') + 1);
  const buffer = Buffer.from(base64, 'base64');

  const x0 = Math.max(0, region.x - PAD_PCT);
  const y0 = Math.max(0, region.y - PAD_PCT);
  const x1 = Math.min(100, region.x + region.w + PAD_PCT);
  const y1 = Math.min(100, region.y + region.h + PAD_PCT);

  const left = Math.round((x0 / 100) * page.width);
  const top = Math.round((y0 / 100) * page.height);
  const width = Math.max(1, Math.round(((x1 - x0) / 100) * page.width));
  const height = Math.max(1, Math.round(((y1 - y0) / 100) * page.height));

  const cropped = await sharp(buffer)
    .extract({ left, top, width, height })
    .jpeg({ quality: 85 })
    .toBuffer();

  return `data:image/jpeg;base64,${cropped.toString('base64')}`;
}
