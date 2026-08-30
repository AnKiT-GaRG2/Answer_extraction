'use client';

import { useEffect, useState } from 'react';

type Spark = {
  id: number;
  x: number;
  y: number;
};

const SVG_SIZE = 60;
const CENTER = SVG_SIZE / 2;
const LIFETIME_MS = 1800; // matches the real site's element removal timing (measured ~1795-1845ms)

// The 4 (dx, dy) offsets captured twice from the official site's own click
// effect were identical both times, so this is a fixed pattern, not
// randomized per click. Scaled up 2.5x from the raw captured values (which
// only travel ~15px) so the burst reads clearly instead of looking tiny.
const SCALE = 2.5;
const SPARK_OFFSETS: [number, number][] = [
  [10.6066 * SCALE, -10.6066 * SCALE],
  [2.6047 * SCALE, -14.7721 * SCALE],
  [-6.3393 * SCALE, -13.5946 * SCALE],
  [-12.9904 * SCALE, -7.5 * SCALE],
];

let nextSparkId = 0;

/**
 * Reverse-engineered from the official VedaAI marketing site's own click
 * effect (captured via a DevTools MutationObserver script, not guessed):
 * clicking anywhere spawns a small SVG burst of 4 dashes at the cursor,
 * each translating outward by a fixed offset while fading, then removes
 * itself from the DOM after ~1.8s.
 */
export function ClickSparkEffect() {
  const [sparks, setSparks] = useState<Spark[]>([]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const id = nextSparkId++;
      setSparks((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setSparks((prev) => prev.filter((s) => s.id !== id));
      }, LIFETIME_MS);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
      {sparks.map((spark) => (
        <svg
          key={spark.id}
          className="absolute overflow-visible"
          style={{ left: spark.x - CENTER, top: spark.y - CENTER, width: SVG_SIZE, height: SVG_SIZE }}
        >
          {SPARK_OFFSETS.map(([dx, dy], i) => (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={CENTER}
              y2={CENTER}
              stroke="#000"
              strokeWidth={5}
              strokeLinecap="square"
              className="animate-click-spark-line"
              style={{ '--spark-dx': `${dx}px`, '--spark-dy': `${dy}px` } as React.CSSProperties}
            />
          ))}
        </svg>
      ))}
    </div>
  );
}
