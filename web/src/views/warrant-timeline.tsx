import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { EventTable } from "@/components/event-table"
import { ModeChip } from "@/components/pills"
import { NOW, MIN, events, gaps, subjects, warrants, warrantById } from "@/data"
import { blocked, type Filters } from "@/lib/filters"
import { fmtHM, fmtN, rel, subjName } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Props { filters: Filters; warrant: string | null; setWarrant: (id: string) => void; onOpenEvent: (id: string) => void }
const ON = { downgrade: "강등 — 세션은 살고 권한만 죽는다", kill: "종료 — scope 프로세스 일괄 종료", grace: "유예 — 세션만 자르고 백그라운드 잡은 grace 까지" }

export function WarrantTimeline({ filters, warrant, setWarrant, onOpenEvent }: Props) {
  const ws = warrants.filter((w) => filters.node === "all" || w.node === filters.node)
  const w = (warrant && ws.find((x) => x.id === warrant)) ? warrantById[warrant] : ws[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {ws.map((x) => {
          const status = x.expires > NOW ? `만료 ${rel(x.expires)}` : x.on_expiry === "grace" ? "유예 중" : "만료됨"
          const on = w?.id === x.id
          return (
            <button key={x.id} onClick={() => setWarrant(x.id)} aria-pressed={on}
              className={cn("flex min-w-[210px] flex-col gap-0.5 rounded-md border bg-card px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", on && "border-primary bg-accent hover:bg-accent")}>
              <span className="flex items-center gap-1.5 font-mono text-[13px] font-semibold">{x.id} <ModeChip mode={x.mode} /></span>
              <span className="text-xs text-foreground/70">{subjName(x.subject)} · {x.node} · {status}</span>
            </button>
          )
        })}
      </div>
      {!w ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">이 노드에는 영장이 없습니다</CardContent></Card> : (() => {
        const graceEnd = w.on_expiry === "grace" ? w.expires + 120 * MIN : null
        const t0 = w.lineage[0].t, t1 = Math.max(graceEnd ?? w.expires, NOW) + 5 * MIN
        const px = (t: number) => ((t - t0) / (t1 - t0)) * 100
        const ev = events.filter((e) => e.warrant === w.id)
        const gs = gaps.filter((g) => g.node === w.node && g.from >= w.issued)
        return (<>
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-sm">{w.id}</CardTitle><CardDescription>{w.reason}</CardDescription>
              <CardAction className="text-xs text-muted-foreground">발급 {fmtHM(w.issued)} · {rel(w.issued)}</CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
                <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">주체</div><div className="mt-0.5">{subjName(w.subject)} <span className="text-muted-foreground">{subjects[w.subject].email}</span></div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">대상 · 바인딩</div><div className="mt-0.5">{w.node} <span className="font-mono text-muted-foreground">{w.session} → cgroup {w.cgroup}</span></div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">정책</div><div className="mt-0.5">
                  write {w.policy.write.length ? w.policy.write.map((p) => <span key={p} className="font-mono">{p}</span>) : <span className="text-muted-foreground">없음(read-only)</span>} · exec {w.policy.exec} · net {w.policy.net.length ? w.policy.net.map((p) => <span key={p} className="font-mono">{p}</span>) : <span className="text-muted-foreground">전면 차단</span>}
                </div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">모드 · 만료 동작</div><div className="mt-0.5 flex items-center gap-1.5"><ModeChip mode={w.mode} /> {ON[w.on_expiry]}</div></div>
              </div>
              {/* 유효기간 띠 */}
              <div className="relative h-[22px] overflow-hidden rounded bg-muted" aria-hidden>
                <div className="absolute inset-y-0 border-r-2 border-primary bg-accent" style={{ left: `${px(w.issued)}%`, width: `${px(w.expires) - px(w.issued)}%` }}><span className="absolute top-[3px] px-1.5 font-mono text-[11px] text-foreground/70">발급 {fmtHM(w.issued)}</span></div>
                {graceEnd && <div className="hatch-warn absolute inset-y-0" style={{ left: `${px(w.expires)}%`, width: `${px(graceEnd) - px(w.expires)}%` }}><span className="absolute top-[3px] px-1.5 font-mono text-[11px] text-foreground/70">유예 → {fmtHM(graceEnd)}</span></div>}
                <div className="absolute inset-y-0 w-0.5 bg-deny" style={{ left: `${px(NOW)}%` }} />
                <span className="absolute right-0 top-[3px] px-1.5 font-mono text-[11px] text-foreground/70">만료 {fmtHM(w.expires)}</span>
              </div>
              {/* 계보 */}
              <ol className="flex flex-col">
                {[...w.lineage.map((l) => ({ ...l, now: false })), ...(w.expires > NOW ? [{ t: NOW, kind: "지금", who: `만료까지 ${rel(w.expires).replace(" 후", "")}`, note: "", now: true }] : [])].map((l, i, arr) => (
                  <li key={i} className="relative grid grid-cols-[62px_18px_1fr] gap-x-2.5 pb-3.5">
                    {i < arr.length - 1 && <span className="absolute left-[80px] top-3.5 -bottom-0.5 w-0.5 bg-input" aria-hidden />}
                    <span className="pt-px font-mono text-xs text-foreground/70">{fmtHM(l.t)}</span>
                    <span className={cn("z-[1] mt-1 ml-1 size-2.5 rounded-full border-2 border-primary bg-card", /만료/.test(l.kind) && "border-muted-foreground bg-muted-foreground", l.now && "border-deny bg-deny")} />
                    <span className="text-xs"><span className="font-semibold">{l.kind}</span> <span className="text-foreground/70">· {l.who}</span>{l.note && <><br /><span className="mt-0.5 inline-block rounded bg-muted px-2 py-1 text-foreground/80">{l.note}</span></>}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card className="pb-0">
            <CardHeader><CardTitle className="text-sm">이 영장의 이벤트</CardTitle><CardDescription>{fmtN(ev.length)}건 · 차단 {fmtN(ev.filter(blocked).length)} · 유실 구간 {gs.length}</CardDescription></CardHeader>
            <EventTable events={ev} gaps={gs} onSelect={onOpenEvent} />
          </Card>
        </>)
      })()}
    </div>
  )
}
