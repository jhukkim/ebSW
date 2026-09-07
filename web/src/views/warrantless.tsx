import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EventTable } from "@/components/event-table"
import { SeverityChip } from "@/components/pills"
import { events, warrantless } from "@/data"
import type { Filters } from "@/lib/filters"
import { fmtT, rel } from "@/lib/format"

interface Props { filters: Filters; selected: number | null; setSelected: (cg: number) => void; onOpenEvent: (id: string) => void }

export function Warrantless({ filters, selected, setSelected, onOpenEvent }: Props) {
  const wl = warrantless.filter((s) => filters.node === "all" || s.node === filters.node)
  const s = wl.find((x) => x.cgroup === selected) ?? wl[0]
  const ev = s ? events.filter((e) => e.warrant === null && e.cgroup === s.cgroup) : []
  return (
    <div className="flex flex-col gap-4">
      <Card className="pb-0">
        <CardHeader><CardTitle className="text-sm">영장 없이 열린 세션</CardTitle><CardDescription>PAM 이 영장을 못 찾았거나 warrantd 에 못 붙어 fail-open 으로 허용된 접속 (§17)</CardDescription></CardHeader>
        {wl.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>등급</TableHead><TableHead>노드</TableHead><TableHead>세션 · cgroup</TableHead><TableHead>uid</TableHead><TableHead>출발지</TableHead><TableHead>시작</TableHead><TableHead>귀속 이벤트</TableHead><TableHead>왜 무영장인가</TableHead></TableRow></TableHeader>
              <TableBody className="text-[12.5px]">
                {wl.map((x) => (
                  <TableRow key={x.cgroup} tabIndex={0} className="cursor-pointer" data-state={s?.cgroup === x.cgroup ? "selected" : undefined}
                    onClick={() => setSelected(x.cgroup)} onKeyDown={(k) => { if (k.key === "Enter") setSelected(x.cgroup) }}>
                    <TableCell><SeverityChip s={x.severity} /></TableCell>
                    <TableCell className="font-mono text-xs">{x.node}</TableCell>
                    <TableCell className="font-mono text-xs">{x.session} · {x.cgroup}</TableCell>
                    <TableCell className="font-mono text-xs">{x.uid}{x.uid === 0 ? " (root)" : ""}</TableCell>
                    <TableCell className="font-mono text-xs">{x.from}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{fmtT(x.first)} <span className="text-muted-foreground">{rel(x.first)}</span></TableCell>
                    <TableCell className="tabular-nums">{x.count}</TableCell>
                    <TableCell>{x.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <div className="p-8 text-center text-sm text-muted-foreground">무영장 세션이 없습니다</div>}
      </Card>
      <Card className="pb-0">
        <CardHeader><CardTitle className="text-sm">세션 안에서 일어난 일</CardTitle><CardDescription>{s ? `${s.node} · ${s.session} · ${ev.length}건 — exec·connect 만 귀속 기록, 판정 없음` : "세션을 고르면 표시"}</CardDescription></CardHeader>
        <EventTable events={ev} gaps={[]} onSelect={onOpenEvent} />
      </Card>
      <p className="max-w-[72ch] text-xs leading-relaxed text-muted-foreground"><b className="text-foreground/80">판정은 없다.</b> 무영장 프로세스는 §13 ②③ 에서 “관리 대상 아님”으로 빠져나가고, 감사 모드는 exec·connect 를 cgroup 에 귀속시켜 기록만 한다. 이 화면의 숫자가 0이 아닌 조직이 고객이다 (§08).</p>
    </div>
  )
}
