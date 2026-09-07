import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { VerdictPill, NoWarrantChip } from "@/components/pills"
import { HOOKS, type AuditEvent, type Gap } from "@/data"
import { fmtN, fmtT, subjName } from "@/lib/format"
import { cn } from "@/lib/utils"

function What({ e }: { e: AuditEvent }) {
  switch (e.hook) {
    case "exec": {
      const flags = [e.setuid ? "setuid" : null, e.interp ? `interp ${e.interp}` : null].filter(Boolean).join(" · ")
      return (
        <div className="min-w-[260px]">
          <div className="font-mono text-xs">{e.filename}</div>
          <div className="font-mono text-[11px] text-muted-foreground">dev {e.dev} · ino {fmtN(e.ino!)}{flags ? ` · ${flags}` : ""}</div>
          <div className="text-xs text-muted-foreground/85"><span className="text-[10px] uppercase tracking-wider">argv </span>{e.argv}</div>
        </div>
      )
    }
    case "write": case "unlink": case "rename":
      return (
        <div className="min-w-[260px]">
          <div className="font-mono text-xs">{e.path}</div>
          <div className="font-mono text-[11px] text-muted-foreground">dev {e.dev} · ino {fmtN(e.ino!)} · 부모 ino {fmtN(e.parent_ino!)}{e.flags ? ` · ${e.flags}` : ""}</div>
          {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
        </div>
      )
    case "connect":
      return (
        <div className="min-w-[260px]">
          <div className="font-mono text-xs">{e.family === "AF_UNIX" ? e.addr : `${e.addr}:${e.port}`}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{e.family}{e.family === "AF_UNIX" ? " · 위임 소켓 (§04 2겹)" : ""}</div>
          {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
        </div>
      )
    case "agg":
      return <div>허용 쓰기 집계 <b className="tabular-nums">{fmtN(e.count!)}</b>건 / {e.window} <span className="text-muted-foreground">— 개별 기록 없음 (§11)</span></div>
    case "self":
      return <div>{e.note}</div>
  }
}

interface Props {
  events: AuditEvent[]
  gaps: Gap[]
  selectedId?: string | null
  onSelect: (id: string) => void
  emptyMsg?: string
}

/** 이벤트와 유실 구간을 시간순으로 섞어 표를 만든다. 유실 구간은 숨기지 않는다. */
export function EventTable({ events, gaps, selectedId, onSelect, emptyMsg = "해당하는 이벤트가 없습니다" }: Props) {
  type Item = { t: number; key: string; node: React.ReactNode }
  const items: Item[] = [
    ...events.map((e): Item => ({
      t: e.ts, key: e.id,
      node: (
        <TableRow
          key={e.id} tabIndex={0} data-state={selectedId === e.id ? "selected" : undefined}
          className={cn("cursor-pointer", e.hook === "agg" && "text-muted-foreground")}
          onClick={() => onSelect(e.id)} onKeyDown={(k) => { if (k.key === "Enter") onSelect(e.id) }}
        >
          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtT(e.ts)}</TableCell>
          <TableCell><VerdictPill v={e.verdict} /></TableCell>
          <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">{HOOKS[e.hook]}</TableCell>
          <TableCell className="whitespace-nowrap">
            {e.warrant ? (<>{subjName(e.subject)}<br /><span className="font-mono text-[11px] text-muted-foreground">{e.warrant}</span></>)
              : (<><NoWarrantChip /><br /><span className="font-mono text-[11px] text-muted-foreground">cgroup {e.cgroup}</span></>)}
          </TableCell>
          <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">{e.node}</TableCell>
          <TableCell><What e={e} /></TableCell>
          <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">pid {e.pid}<br />uid {e.uid}→{e.euid}</TableCell>
        </TableRow>
      ),
    })),
    ...gaps.map((g): Item => ({
      t: g.from, key: `gap-${g.node}-${g.seq_from}`,
      node: (
        <TableRow key={`gap-${g.node}-${g.seq_from}`} className="hover:bg-transparent">
          <TableCell colSpan={7} className="hatch text-xs text-muted-foreground">
            <b className="text-foreground">감사 유실 구간</b> · {g.node} · {fmtT(g.from)} – {fmtT(g.to)} · seq {fmtN(g.seq_from)} → {fmtN(g.seq_to)} · <b className="text-foreground">dropped {fmtN(g.dropped)}</b> · {g.cause}
          </TableCell>
        </TableRow>
      ),
    })),
  ].sort((a, b) => b.t - a.t)

  if (!items.length) return <div className="p-8 text-center text-sm text-muted-foreground">{emptyMsg}</div>
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>시각</TableHead><TableHead>판정</TableHead><TableHead>훅</TableHead><TableHead>주체 · 영장</TableHead>
            <TableHead>노드</TableHead><TableHead>대상 (근거: dev, ino)</TableHead><TableHead>프로세스</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-[12.5px] [&_td]:align-top">{items.map((i) => i.node)}</TableBody>
      </Table>
    </div>
  )
}
