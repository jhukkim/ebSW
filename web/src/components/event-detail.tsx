import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { VerdictPill, ModeChip, NoWarrantChip } from "@/components/pills"
import { HOOKS, NOW, subjects, warrantById, type AuditEvent } from "@/data"
import { fmtN, fmtT, subjName } from "@/lib/format"
import { cn } from "@/lib/utils"

function KV({ rows }: { rows: [string, React.ReactNode, boolean?][] }) {
  return (
    <dl className="grid grid-cols-[96px_1fr] gap-x-2.5 gap-y-1 text-xs">
      {rows.map(([k, v, sans]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className={cn("break-all", !sans && "font-mono")}>{v}</dd></div>))}
    </dl>
  )
}
const Note = ({ children, warn }: { children: React.ReactNode; warn?: boolean }) => (
  <div className={cn("rounded-md px-2.5 py-2 text-xs leading-snug", warn ? "bg-warn-wash text-warn" : "bg-muted text-foreground/80")}>{children}</div>
)
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>

export function EventDetail({ e }: { e: AuditEvent | undefined }) {
  if (!e) {
    return (
      <Card className="sticky top-[76px]">
        <CardHeader><CardTitle className="text-sm">상세</CardTitle></CardHeader>
        <CardContent><div className="py-6 text-center text-sm text-muted-foreground">행을 고르면 레코드 전체 필드를 보여줍니다</div></CardContent>
      </Card>
    )
  }
  const w = e.warrant ? warrantById[e.warrant] : null
  let payload: React.ReactNode
  if (e.hook === "exec") payload = <KV rows={[["filename", e.filename], ["dev · ino", `${e.dev} · ${fmtN(e.ino!)}`], ["interp", e.interp ?? "= filename"], ["setuid", e.setuid ? "S_ISUID — lint 경고 대상" : "아니오"], ["argv", <span className="text-muted-foreground">{e.argv}</span>]]} />
  else if (e.hook === "write" || e.hook === "unlink" || e.hook === "rename") payload = <KV rows={[["path", e.path], ["dev · ino", `${e.dev} · ${fmtN(e.ino!)}`], ["parent ino", fmtN(e.parent_ino!)], ["f_flags", e.flags ?? "—"]]} />
  else if (e.hook === "connect") payload = <KV rows={[["family", e.family], [e.family === "AF_UNIX" ? "sun_path" : "addr", e.addr], ["port", e.family === "AF_UNIX" ? "—" : e.port]]} />
  else if (e.hook === "agg") payload = <KV rows={[["count", fmtN(e.count!)], ["window", e.window]]} />
  else payload = <Note>{e.note}</Note>

  return (
    <Card className="sticky top-[76px] gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><VerdictPill v={e.verdict} /><span className="font-mono font-normal">{HOOKS[e.hook]}</span></CardTitle>
        <CardAction className="font-mono text-xs text-muted-foreground">{fmtT(e.ts)}</CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div><H>귀속</H><KV rows={[
          ["주체", w ? <>{subjName(e.subject)} <span className="text-muted-foreground">({subjects[e.subject!].email})</span></> : <NoWarrantChip />, true],
          ["영장", w ? <span className="flex items-center gap-1.5">{w.id} <ModeChip mode={w.mode} /></span> : "—", true],
          ["정책", w ? `write ${w.policy.write.join(", ") || "없음"} · exec ${w.policy.exec}` : "—", true],
          ["cgroup_id", <>{e.cgroup}{w && <span className="text-muted-foreground"> ({w.session})</span>}</>],
          ["node · seq", `${e.node} · ${fmtN(e.seq)}`],
        ]} /></div>
        <Separator />
        <div><H>프로세스 (공통 메타 §03)</H><KV rows={[
          ["pid · tgid", `${e.pid} · ${e.tgid}`],
          ["start_time", `${fmtN(Math.round((e.start_time - (NOW - 90 * 24 * 3600 * 1000)) / 1000))}s (boot)`],
          ["ppid", String(e.ppid)],
          ["uid → euid", `${e.uid} → ${e.euid}`],
          ["comm", <span className="text-muted-foreground">{e.comm}</span>],
          ["pid ns · mnt ns", `${e.pid_ns} · ${e.mnt_ns}`],
        ]} /></div>
        <Separator />
        <div><H>페이로드</H>{payload}</div>
        {e.hook === "exec" && <Note><b>argv 는 참고 정보입니다.</b> <span className="font-mono">exec -a</span> 로 위조되고 BPF 스택 제약으로 잘립니다. 근거는 커널이 실제로 연 바이너리의 (dev, ino) 입니다 (§14).</Note>}
        {e.euid === 0 && <Note warn>euid 0 은 신원이 아니라 정황입니다. 신원은 subject_id 에 있습니다 (§03).</Note>}
        {e.hook === "agg" && <Note>허용된 쓰기는 개별 기록하지 않습니다. per-CPU 카운터를 5분마다 한 건으로 올린 값입니다 (§11).</Note>}
        {e.verdict === "WOULD_DENY" && <Note>dry-run 영장 — 강제 모드였다면 <span className="font-mono">-EPERM</span>. 같은 판정 함수를 쓰므로 강제 전환 시 결과가 달라지지 않습니다 (§15).</Note>}
      </CardContent>
    </Card>
  )
}
