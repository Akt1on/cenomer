import { useMemo, useState } from "react";
import { formatRub } from "@/lib/format";

type Datum = { date: string; price: number };

const PADDING = 16;
const HEIGHT = 240;
const WIDTH = 840;

function createLinePath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

export default function ProductPriceChart({ data }: { data: Datum[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((item) => item.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerWidth = WIDTH - PADDING * 2;
    const innerHeight = HEIGHT - PADDING * 2;

    const points = data.map((item, index) => {
      const x = PADDING + (innerWidth * index) / Math.max(data.length - 1, 1);
      const normalized = (item.price - min) / range;
      const y = PADDING + innerHeight - normalized * innerHeight;
      return { ...item, x, y };
    });

    return {
      min,
      max,
      points,
      path: createLinePath(points),
    };
  }, [data]);

  if (!chart) {
    return (
      <div className="h-64 grid place-items-center rounded-3xl border border-border bg-card text-sm text-muted-foreground">
        Нет данных для графика
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>История цен</span>
        <span>{`${data.length} точек`}</span>
      </div>
      <div className="h-[24rem] w-full">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-full w-full"
          aria-label="График истории цен"
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-success)" />
            </linearGradient>
          </defs>

          {Array.from({ length: 4 }, (_, index) => {
            const y = PADDING + ((HEIGHT - PADDING * 2) * index) / 3;
            const value = chart.max - ((chart.max - chart.min) * index) / 3;
            return (
              <g key={index}>
                <line
                  x1={PADDING}
                  y1={y}
                  x2={WIDTH - PADDING}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                />
                <text x={PADDING} y={y - 6} fill="var(--color-muted-foreground)" fontSize={12}>
                  {formatRub(value)}
                </text>
              </g>
            );
          })}

          <path
            d={chart.path}
            fill="none"
            stroke="url(#priceGradient)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {chart.points.map((point, index) => (
            <g key={point.date}>
              <circle
                cx={point.x}
                cy={point.y}
                r={hoverIndex === index ? 6 : 4}
                fill="var(--color-primary)"
                stroke="var(--color-card)"
                strokeWidth="2"
              />
              <rect
                x={Math.max(point.x - 20, PADDING)}
                y={PADDING}
                width={40}
                height={HEIGHT - PADDING * 2}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          ))}
        </svg>
      </div>
      {hoverIndex !== null && (
        <div className="mt-4 rounded-2xl border border-border bg-popover p-3 text-sm shadow-soft">
          <p className="font-medium">{data[hoverIndex].date}</p>
          <p className="text-foreground">{formatRub(data[hoverIndex].price)}</p>
        </div>
      )}
    </div>
  );
}
