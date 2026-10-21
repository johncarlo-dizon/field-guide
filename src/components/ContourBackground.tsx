"use client";

import { useEffect, useState } from "react";

const W = 1600;
const H = 1000;
const NX = 64; // grid cells across
const NY = 40; // grid cells down
const LEVELS = 14; // how many contour lines

// A smooth landscape: a few waves added together.
function field(x: number, y: number): number {
  const X = x * 1.6; // keeps the shapes round on a wide page
  return (
    Math.sin(X * 3.4 + 0.6) * Math.cos(y * 4.1 - 0.3) +
    0.55 * Math.sin(X * 5.9 + y * 6.3 + 1.7) +
    0.3 * Math.cos(X * 8.1 - y * 9.2 + 0.4)
  );
}

type Pt = [number, number];

// Traces the lines where the landscape crosses each height ("marching squares").
function buildContours(): string {
  const v: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= NY; j++) {
    const row: number[] = [];
    for (let i = 0; i <= NX; i++) {
      const val = field(i / NX, j / NY);
      row.push(val);
      if (val < min) min = val;
      if (val > max) max = val;
    }
    v.push(row);
  }

  const r = (n: number) => Math.round(n * 10) / 10;
  const px = (i: number) => (i / NX) * W;
  const py = (j: number) => (j / NY) * H;
  let d = "";

  for (let L = 1; L < LEVELS; L++) {
    const t = min + ((max - min) * L) / LEVELS;
    const at = (p: number, q: number) => (p === q ? 0.5 : (t - p) / (q - p));

    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = v[j][i]; // top left
        const b = v[j][i + 1]; // top right
        const c = v[j + 1][i + 1]; // bottom right
        const e = v[j + 1][i]; // bottom left
        const idx = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (e > t ? 1 : 0);
        if (idx === 0 || idx === 15) continue;

        const top: Pt = [px(i + at(a, b)), py(j)];
        const right: Pt = [px(i + 1), py(j + at(b, c))];
        const bottom: Pt = [px(i + at(e, c)), py(j + 1)];
        const left: Pt = [px(i), py(j + at(a, e))];
        const centerHigh = (a + b + c + e) / 4 > t;

        const pairs: [Pt, Pt][] = [];
        switch (idx) {
          case 1: case 14: pairs.push([left, bottom]); break;
          case 2: case 13: pairs.push([bottom, right]); break;
          case 3: case 12: pairs.push([left, right]); break;
          case 4: case 11: pairs.push([top, right]); break;
          case 6: case 9: pairs.push([top, bottom]); break;
          case 7: case 8: pairs.push([top, left]); break;
          case 5:
            if (centerHigh) pairs.push([top, left], [bottom, right]);
            else pairs.push([top, right], [left, bottom]);
            break;
          case 10:
            if (centerHigh) pairs.push([top, right], [left, bottom]);
            else pairs.push([top, left], [bottom, right]);
            break;
        }
        for (const [p, q] of pairs) d += `M${r(p[0])} ${r(p[1])}L${r(q[0])} ${r(q[1])}`;
      }
    }
  }
  return d;
}

export default function ContourBackground() {
  const [d, setD] = useState("");
  useEffect(() => { setD(buildContours()); }, []);

  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "#ffffff" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: d ? 1 : 0, transition: "opacity 0.8s ease" }}
      >
        <path
          d={d}
          fill="none"
          stroke="#171717"
          strokeOpacity="0.08"
          strokeWidth="1.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* A white glow in the middle keeps the lines away from the content */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 55% 60% at 50% 45%, #ffffff 35%, rgba(255,255,255,0) 100%)",
        }}
      />
    </div>
  );
}