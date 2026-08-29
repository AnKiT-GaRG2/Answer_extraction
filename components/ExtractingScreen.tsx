'use client';

export function ExtractingScreen({ stageLabel }: { stageLabel: string }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl bg-card px-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Icon.png" alt="" className="h-32 w-32 animate-sparkle-pulse object-contain" />
        <h2
          className="animate-shimmer bg-[length:200%_100%] bg-clip-text text-[30px] font-bold leading-9 text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg,#303030,#606060,#808080,#606060,#303030)' }}
        >
          Extracting...
        </h2>
        <p className="text-xl text-[#464646]">{stageLabel}</p>
      </div>
    </div>
  );
}
