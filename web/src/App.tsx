import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/label"
import { Overview } from "@/views/overview"
import { AuditSearch } from "@/views/audit-search"
import { WarrantTimeline } from "@/views/warrant-timeline"
import { Warrantless } from "@/views/warrantless"
import { NOW, nodes } from "@/data"
import { DEFAULT_FILTERS, baseEvents, blocked, warrantlessIn, type Filters, type Range } from "@/lib/filters"
import { fmtN } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Search, GitCommitHorizontal, ShieldAlert, FilePlus2, Inbox } from "lucide-react"

type View = "overview" | "search" | "timeline" | "warrantless"
const TITLES: Record<View, string> = { overview: "개요", search: "감사 검색", timeline: "세션 타임라인", warrantless: "무영장 세션" }

export default function App() {
  const [view, setView] = useState<View>("overview")
  const [filters, setF] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<string | null>(null)
  const [warrant, setWarrant] = useState<string | null>("W-4821-3F")
  const [wlSel, setWlSel] = useState<number | null>(null)
  const setFilters = (p: Partial<Filters>) => setF((f) => ({ ...f, ...p }))

  const all = baseEvents(filters)
  const blockedN = all.filter(blocked).length
  const wlN = warrantlessIn(filters).length

  /** 다른 화면에서 행을 누르면 검색 화면으로 가서 그 레코드를 연다. 검색 필터는 초기화한다. */
  const openEvent = (id: string, subject: Filters["subject"] = "all") => { setSelected(id); setFilters({ verdict: "all", hook: "all", subject, q: "" }); setView("search") }
  const openSession = (cg: number) => { setWlSel(cg); setView("warrantless") }

  const NavItem = ({ v, icon: Icon, count, hot }: { v: View; icon: React.ComponentType<{ className?: string }>; count?: string; hot?: boolean }) => (
    <Button variant="ghost" size="sm" aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}
      className={cn("h-8 w-full justify-start gap-2 px-2 font-normal text-foreground/75", view === v && "bg-accent font-semibold text-accent-foreground hover:bg-accent")}>
      <Icon className="size-4" />{TITLES[v]}
      {count && <span className={cn("ml-auto font-mono text-[11px]", hot ? "font-semibold text-deny" : "text-muted-foreground")}>{count}</span>}
    </Button>
  )

  return (
    <TooltipProvider>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[208px_1fr]">
        <aside className="flex flex-col gap-5 border-b bg-card p-4 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
          <div className="px-1.5">
            <div className="text-[15px] font-bold tracking-tight">Session Warrant</div>
            <div className="text-[11.5px] uppercase tracking-wider text-muted-foreground">감사 콘솔 · 프로토타입</div>
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="화면">
            <div className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-widest text-muted-foreground">감사</div>
            <NavItem v="overview" icon={LayoutDashboard} />
            <NavItem v="search" icon={Search} count={fmtN(blockedN)} />
            <NavItem v="timeline" icon={GitCommitHorizontal} />
            <NavItem v="warrantless" icon={ShieldAlert} count={wlN ? String(wlN) : undefined} hot />
            <div className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-widest text-muted-foreground">발급</div>
            <Button variant="ghost" size="sm" disabled title="이번 학기 범위 밖 — Slack 승인 연동 이후" className="h-8 w-full justify-start gap-2 px-2 font-normal"><FilePlus2 className="size-4" />영장 발급<Badge variant="outline" className="ml-auto h-4 px-1 text-[10px]">범위 밖</Badge></Button>
            <Button variant="ghost" size="sm" disabled title="이번 학기 범위 밖 — Slack 승인 연동 이후" className="h-8 w-full justify-start gap-2 px-2 font-normal"><Inbox className="size-4" />승인 큐<Badge variant="outline" className="ml-auto h-4 px-1 text-[10px]">범위 밖</Badge></Button>
          </nav>
          <div className="mt-auto hidden px-1.5 text-[11.5px] leading-relaxed text-muted-foreground md:block">
            <b className="font-semibold text-foreground/70">실행된 모든 프로세스</b>를 사람에게 귀속시켜 기록합니다.<br />
            셸 빌트인(<span className="font-mono">cd</span>·<span className="font-mono">echo</span>)과 터미널 입력은 남지 않습니다 (§14).
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b bg-card px-7 py-3">
            <h1 className="text-[17px] font-semibold">{TITLES[view]}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Label>기간
                <ToggleGroup type="single" variant="outline" size="sm" value={String(filters.range)} onValueChange={(v) => { if (v) setFilters({ range: Number(v) as Range }) }}>
                  <ToggleGroupItem value="60" className="px-2.5 text-xs">1시간</ToggleGroupItem>
                  <ToggleGroupItem value="180" className="px-2.5 text-xs">3시간</ToggleGroupItem>
                  <ToggleGroupItem value="360" className="px-2.5 text-xs">6시간</ToggleGroupItem>
                </ToggleGroup>
              </Label>
              <Label>노드
                <Select value={filters.node} onValueChange={(v) => setFilters({ node: v })}>
                  <SelectTrigger size="sm" className="w-[210px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">전체 노드</SelectItem>{Object.keys(nodes).map((n) => <SelectItem key={n} value={n}>{n} · {nodes[n].mode}</SelectItem>)}</SelectContent>
                </Select>
              </Label>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">기준 시각 <span className="font-mono">{new Date(NOW).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span> · 목 데이터 · 데이터 소스: 중앙 감사 API 자리</div>
          </header>
          <main className="flex flex-col gap-5 px-7 pb-10 pt-5">
            {view === "overview" && <Overview filters={filters} onOpenEvent={openEvent} onOpenSession={openSession} />}
            {view === "search" && <AuditSearch filters={filters} setFilters={setFilters} selected={selected} onSelect={setSelected} />}
            {view === "timeline" && <WarrantTimeline filters={filters} warrant={warrant} setWarrant={setWarrant} onOpenEvent={openEvent} />}
            {view === "warrantless" && <Warrantless filters={filters} selected={wlSel} setSelected={setWlSel} onOpenEvent={(id) => openEvent(id, "none")} />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
