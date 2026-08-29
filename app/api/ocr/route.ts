import { NextRequest, NextResponse } from 'next/server';
import { ocrPagesWithGemini } from '@/lib/gemini-ocr';
import { serverLog, timed } from '@/lib/log';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = { pages: { pageIndex: number; dataUrl: string }[] };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const label = body.pages.map((p) => p.pageIndex).join(',');
    const totalKB = body.pages.reduce((sum, p) => sum + p.dataUrl.length / 1024, 0);
    serverLog(`/api/ocr: page(s) ${label}, payload ${totalKB.toFixed(0)}KB`);
    const lines = await timed(`ocrPages(${label})`, () => ocrPagesWithGemini(body.pages));
    serverLog(`/api/ocr: page(s) ${label} -> ${lines.length} line(s)`);
    return NextResponse.json({ lines });
  } catch (err) {
    console.error('ocr route failed', err);
    const message = err instanceof Error ? err.message : 'OCR failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
