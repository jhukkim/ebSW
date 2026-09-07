import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { VERD_KO } from "@/lib/format"
import type { Mode, Verdict } from "@/data"

/** 판정 칩 — 색 + 글자. 색만으로 뜻을 싣지 않는다. */
export function VerdictPill({ v, className }: { v: Verdict; className?: string }) {
  const tone = { ALLOW: "text-allow bg-allow/10", WOULD_DENY: "text-would bg-would/10", DENY: "text-deny bg-deny/12" }[v]
  return (
    <Badge variant="outline" title={VERD_KO[v]} className={cn("gap-1.5 border-transparent font-mono text-[11px] font-semibold tracking-wide", tone, className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {v}
    </Badge>
  )
}

export function ModeChip({ mode }: { mode: Mode }) {
  const tone = { enforce: "border-deny text-deny", dryrun: "border-would text-would", observe: "text-muted-foreground" }[mode]
  return <Badge variant="outline" className={cn("h-5 px-1.5 font-mono text-[11px] font-medium", tone)}>{mode}</Badge>
}

export function SeverityChip({ s }: { s: "critical" | "warning" }) {
  return (
    <Badge variant="outline" className={cn("h-5 border-transparent px-1.5 text-[11px] font-medium", s === "critical" ? "bg-deny-wash text-deny" : "bg-warn-wash text-warn")}>
      {s}
    </Badge>
  )
}

export function NoWarrantChip() {
  return <Badge variant="outline" className="h-5 border-transparent bg-deny-wash px-1.5 text-[11px] font-medium text-deny">무영장</Badge>
}
