#!/usr/bin/env python3
"""S3 결과를 판정한다.

  python3 report.py out/<타임스탬프>

기획서 §11 T1 의 가정 하나를 참/거짓으로 답한다:
"PAM 스택에서 pam_systemd.so 뒤에 놓으면 session-N.scope 가 이미 있다."
"""
import os
import re
import sys
from collections import Counter, defaultdict

KV = re.compile(r"(\w+)=(\S*)")


def load(path):
    rows = []
    with open(path) as fh:
        for ln in fh:
            if "phase=" in ln:
                rows.append(dict(KV.findall(ln)))
    return rows


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    env = os.path.join(d, "env.txt")
    if os.path.exists(env):
        print(open(env).read())
    log = os.path.join(d, "pamprobe.log")
    if not os.path.exists(log):
        log = d if os.path.isfile(d) else None
    if not log:
        print("pamprobe.log 가 없다")
        return
    rows = load(log)
    if not rows:
        print("기록이 없다 — 모듈이 안 불렸다. PAM 스택 삽입을 확인할 것")
        return

    by = defaultdict(list)
    for r in rows:
        by[(r.get("service", "?"), r.get("phase", "?"))].append(r)

    print("── 서비스 · 단계별 ──────────────────────────────────────────")
    print()
    print(f"  {'service':<12} {'phase':<15} {'건':>4} {'scope 있음':>11} "
          f"{'proc=scope':>11} {'대기 최대':>10}")
    for (svc, phase), rs in sorted(by.items()):
        ok = sum(1 for r in rs if r.get("present_t0") == "yes")
        match = sum(1 for r in rs if r.get("match") == "yes")
        wmax = max((int(r.get("waited_us", 0) or 0) for r in rs), default=0)
        w = f"{wmax/1000:.1f}ms" if wmax else "0"
        print(f"  {svc:<12} {phase:<15} {len(rs):>4} "
              f"{ok:>4}/{len(rs):<6} {match:>4}/{len(rs):<6} {w:>10}")
    print()

    # ── 판정. sshd 의 open_session 이 유일하게 결론을 내는 자리다.
    sess = [r for r in rows if r.get("phase") == "open_session"]
    ssh = [r for r in sess if r.get("service") == "sshd"]
    target = ssh or sess
    scope_label = "sshd" if ssh else f"{target[0].get('service','?')} (sshd 아님)"

    print("── 판정 ─────────────────────────────────────────────────────")
    print()
    if not target:
        print("  open_session 기록이 없다. 판정 불가.")
        return

    n = len(target)
    t0 = sum(1 for r in target if r.get("present_t0") == "yes")
    match = sum(1 for r in target if r.get("match") == "yes")
    sid = sum(1 for r in target if r.get("xdg_session_id", "-") not in ("-", ""))
    waited = [int(r.get("waited_us", 0) or 0) for r in target
              if r.get("present_t0") == "no" and int(r.get("waited_us", 0) or 0)]

    print(f"  대상: {scope_label} · open_session {n}건")
    print()
    print(f"  XDG_SESSION_ID 가 있다        {sid}/{n}")
    print(f"  session-N.scope 가 이미 있다   {t0}/{n}   ← §11 T1 의 가정")
    print(f"  /proc/self/cgroup 과 일치      {match}/{n}")
    print()

    if sid < n:
        print("  ✗ XDG_SESSION_ID 가 비었다. pam_systemd.so 보다 앞에 놓였거나")
        print("    logind 가 이 서비스에 세션을 만들지 않는다.")
        print("    → PAM 스택에서 삽입 위치를 내리고 다시 잰다.")
    elif t0 == n:
        print("  ✓ S3 통과. session 단계에서 scope 가 이미 확정돼 있다.")
        print("    pam_warrant.so 는 XDG_SESSION_ID → 경로 → stat 만으로 cgroup id 를")
        print("    얻을 수 있다. warrantd 의 cgroup 트리 순회는 필요 없다.")
        if match < n:
            print()
            print(f"  ⚠ 다만 {n-match}건에서 /proc/self/cgroup 과 scope 가 다르다.")
            print("    sshd 프로세스 자신은 아직 이관 전일 수 있다 — 제품은")
            print("    /proc/self/cgroup 이 아니라 XDG_SESSION_ID 경로를 써야 한다.")
    elif t0 == 0 and waited:
        lo, hi = min(waited) / 1000, max(waited) / 1000
        print(f"  ✗ S3 실패. scope 가 t0 에 없고 {lo:.1f}~{hi:.1f}ms 뒤에 나타난다.")
        print("    → 이게 태깅 공백이다. 이 구간에 태어난 프로세스는 태그가 없다.")
        print("    → warrantd 가 cgroup 트리를 순회하거나, logind 의 D-Bus")
        print("      SessionNew 를 구독해야 한다. pam/ 와 agent/ 설계가 바뀐다.")
    elif t0 == 0:
        print("  ✗ S3 실패. scope 가 상한(wait_ms) 안에 나타나지 않았다.")
        print("    → 삽입 위치를 확인하고, 맞다면 상한을 올려 다시 잰다.")
    else:
        print(f"  ⚠ 불안정. {n}건 중 {t0}건만 t0 에 있었다.")
        print("    간헐적이면 그게 가장 나쁜 결과다 — 공백이 재현되지 않으면")
        print("    제품에서 언제 태그가 빠졌는지 사후에 알 수 없다.")
        if waited:
            print(f"    나머지는 {min(waited)/1000:.1f}~{max(waited)/1000:.1f}ms 뒤에 나타났다.")

    # close_session — §11 T4 의 정리 시점
    cl = [r for r in rows if r.get("phase") == "close_session"]
    if cl:
        alive = sum(1 for r in cl if r.get("present_t0") == "yes")
        print()
        print(f"  (§11 T4) close_session {len(cl)}건 중 scope 가 아직 살아 있음: {alive}")
        print("    살아 있으면 cgroup_warrant 엔트리 정리를 여기에 걸 수 있다.")

    acct = [r for r in rows if r.get("phase") == "acct_mgmt"]
    if acct:
        a = sum(1 for r in acct if r.get("present_t0") == "yes")
        print()
        print(f"  (§11 T1) acct_mgmt {len(acct)}건 중 scope 있음: {a}")
        print("    account 단계는 영장 유무만 본다. 0 이 정상이다 —")
        print("    0 이 아니면 바인딩을 앞당길 여지가 있다는 뜻이다.")

    svcs = Counter(r.get("service") for r in rows)
    if not ssh:
        print()
        print(f"  주의: sshd 기록이 없다. 지금까지 본 서비스 = {dict(svcs)}")
        print("    2단계(su)까지만 돌린 상태다. 결론은 3단계(sshd)에서 나온다.")


if __name__ == "__main__":
    main()
