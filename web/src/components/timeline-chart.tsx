import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { NOW, MIN, type AuditEvent, type Gap } from "@/data"
import { fmtHM } from "@/lib/format"
import type { Filters } from "@/lib/filters"
import { since } from "@/lib/filters"

// 시리즈 순서 고정: ALLOW → WOULD_DENY → DENY. 필터가 바뀌어도 색은 따라가지 않는다.
const config = {
  ALLOW: { label: "ALLOW", color: "var(--v-allow)" },
  WOULD_DENY: { label: "WOULD_DENY (dry-run)", color: "var(--v-would)" },
  DENY: { label: "DENY (enforce)", color: "var(--v-deny)" },
} satisfies ChartConfig

/** 5분 버킷 스택 막대. 한 축, 유실 구간은 빗금 띠. */
export function TimelineChart({ filters, events, gaps }: { filters: Filters; events: AuditEvent[]; gaps: Gap[] }) {
  const bucket = 5 * MIN, n = (filters.range * MIN) / bucket, t0 = since(filters)
  const rows = Array.from({ length: n }, (_, i) => ({ t: t0 + i * bucket, label: fmtHM(t0 + i * bucket), ALLOW: 0, WOULD_DENY: 0, DENY: 0 }))
  events.forEach((e) => { if (e.hook === "agg") return; rows[Math.min(n - 1, Math.floor((e.ts - t0) / bucket))][e.verdict]++ })
  const labelEvery = n <= 12 ? 1 : n <= 36 ? 3 : 6
  const bucketOf = (t: number) => rows[Math.max(0, Math.min(n - 1, Math.floor((Math.min(t, NOW) - t0) / bucket)))].label

  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart data={rows} barCategoryGap={2} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gap-ink)" strokeWidth="1.2" />
          </pattern>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={labelEvery - 1} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
        {gaps.map((g) => (
          <ReferenceArea key={`${g.node}${g.seq_from}`} x1={bucketOf(g.from)} x2={bucketOf(g.to)} fill="url(#hatch)" stroke="var(--gap-ink)" strokeDasharray="2 3" ifOverflow="extendDomain" />
        ))}
        <ChartTooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }} content={<ChartTooltipContent labelFormatter={(l) => `${l} – 5분`} />} />
        <Bar dataKey="ALLOW" stackId="v" fill="var(--color-ALLOW)" />
        <Bar dataKey="WOULD_DENY" stackId="v" fill="var(--color-WOULD_DENY)" />
        <Bar dataKey="DENY" stackId="v" fill="var(--color-DENY)" radius={[3, 3, 0, 0]} />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}
