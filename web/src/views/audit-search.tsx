import { Card, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/label"
import { EventTable } from "@/components/event-table"
import { EventDetail } from "@/components/event-detail"
import { HOOKS, events, subjects, type Hook } from "@/data"
import { gapsIn, searchEvents, type Filters } from "@/lib/filters"
import { fmtN } from "@/lib/format"

interface Props { filters: Filters; setFilters: (f: Partial<Filters>) => void; selected: string | null; onSelect: (id: string) => void }

export function AuditSearch({ filters, setFilters, selected, onSelect }: Props) {
  const ev = searchEvents(filters)
  const filtered = filters.verdict !== "all" || filters.hook !== "all" || filters.subject !== "all" || filters.q
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label>판정
          <Select value={filters.verdict} onValueChange={(v) => setFilters({ verdict: v as Filters["verdict"] })}>
            <SelectTrigger size="sm" className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem><SelectItem value="blocked">DENY + WOULD_DENY</SelectItem>
              <SelectItem value="DENY">DENY</SelectItem><SelectItem value="WOULD_DENY">WOULD_DENY</SelectItem><SelectItem value="ALLOW">ALLOW</SelectItem>
            </SelectContent>
          </Select>
        </Label>
        <Label>훅
          <Select value={filters.hook} onValueChange={(v) => setFilters({ hook: v as Filters["hook"] })}>
            <SelectTrigger size="sm" className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">전체</SelectItem>{(Object.keys(HOOKS) as Hook[]).map((h) => <SelectItem key={h} value={h} className="font-mono text-xs">{HOOKS[h]}</SelectItem>)}</SelectContent>
          </Select>
        </Label>
        <Label>주체
          <Select value={filters.subject} onValueChange={(v) => setFilters({ subject: v })}>
            <SelectTrigger size="sm" className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem><SelectItem value="none">무영장</SelectItem>
              {Object.values(subjects).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.email})</SelectItem>)}
            </SelectContent>
          </Select>
        </Label>
        <Label><Checkbox checked={filters.agg} onCheckedChange={(c) => setFilters({ agg: c === true })} /> 집계 행 표시</Label>
        <Input type="search" value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} placeholder="경로 · 바이너리 · inode · 주소 · 영장 id" className="h-8 w-[260px]" />
      </div>
      <div className="grid items-start gap-3.5 xl:grid-cols-[1fr_340px]">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle className="text-sm">이벤트</CardTitle>
            <CardDescription>{fmtN(ev.length)}건{filtered ? " (필터 적용)" : ""}</CardDescription>
            <CardAction className="text-xs text-muted-foreground">시간순 · 유실 구간은 제자리에 표시</CardAction>
          </CardHeader>
          <EventTable events={ev} gaps={gapsIn(filters)} selectedId={selected} onSelect={onSelect} />
        </Card>
        <EventDetail e={events.find((x) => x.id === selected)} />
      </div>
    </div>
  )
}
