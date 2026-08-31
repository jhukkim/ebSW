#!/usr/bin/env python3
"""S1 결과를 표로 찍는다.

  python3 report.py out/20260901-000107

매크로는 A 대비 %, 마이크로는 훅 1회당 ns 분포다.
두 숫자를 곱하거나 환산하지 말 것 — PROBE 빌드는 계측 비용을 포함한다.
"""
import json
import math
import os
import re
import statistics as st
import sys
from collections import defaultdict
from glob import glob

# 표시 순서. E 는 D 와 같은 프로그램을 태그 없이 돌린 것이라 D 앞에 놓는다 —
# 기술스택 문서 §검증하네스의 비교군 셋이 A · E · D 다.
TIERS = ["a", "b", "c", "e", "d"]
MICRO_TIERS = ["b", "c", "e", "d"]
TIER_DESC = {
    "a": "훅 없음",
    "b": "return 0 만",
    "c": "+ FMODE_WRITE 앞문",
    "e": "D 와 같음, 영장 없음",
    "d": "+ cgroup·맵2회·시간",
}
PASS_RE = re.compile(r"_p\d+$")


def pct(vals, q):
    if not vals:
        return float("nan")
    i = min(len(vals) - 1, max(0, math.ceil(q * len(vals)) - 1))
    return vals[i]


def load_macro(d):
    """macro_<tier>_<wl>[_p<N>].json 을 티어·워크로드별로 합친다.

    패스를 나눠 교차 실행했으므로 전부 모아야 한 티어의 표본이 된다."""
    out = defaultdict(lambda: defaultdict(list))
    for f in glob(os.path.join(d, "macro_*.json")):
        base = os.path.basename(f)[len("macro_"):-len(".json")]
        base = PASS_RE.sub("", base)
        tier, wl = base.split("_", 1)
        with open(f) as fh:
            out[wl][tier] += json.load(fh)["results"][0]["times"]
    return {wl: {t: sorted(v) for t, v in d2.items()} for wl, d2 in out.items()}


def macro_table(d):
    data = load_macro(d)
    if not data:
        return
    print("── 매크로: 워크로드 벽시계 (A 대비) ─────────────────────────")
    print()
    for wl in sorted(data):
        t = data[wl]
        base = t.get("a")
        n = len(base) if base else 0
        print(f"  {wl}   (n={n})")
        print(f"    {'':4} {'설명':<22} {'mean':>9} {'sd':>7} {'p95':>9} "
              f"{'Δmean':>8} {'판정':>12}")
        for tier in TIERS:
            v = t.get(tier)
            if not v:
                continue
            m, sd = st.mean(v), st.stdev(v) if len(v) > 1 else 0.0
            if base and tier != "a":
                bm, bsd = st.mean(base), st.stdev(base) if len(base) > 1 else 0.0
                dm = (m / bm - 1) * 100
                # 두 표본 평균 차이의 표준오차. 이걸 못 넘으면 잰 게 아니다.
                se = math.hypot(sd / math.sqrt(len(v)), bsd / math.sqrt(len(base)))
                sig = "노이즈 이하" if abs(m - bm) < 2 * se else f"±{2*se/bm*100:.1f}% 초과"
                dms = f"{dm:+7.1f}%"
            else:
                dms, sig = "     — ", ""
            print(f"    {tier.upper():<4} {TIER_DESC[tier]:<22} "
                  f"{m:8.3f}s {sd:6.3f}s {pct(v, 0.95):8.3f}s {dms:>8} {sig:>12}")

        # §13 의 핵심 주장: "영장 없는 프로세스는 조회 한 번으로 빠져나간다".
        # E 와 D 는 같은 프로그램이므로 차이는 영장 유무 하나뿐이다.
        e, dd = t.get("e"), t.get("d")
        if e and dd:
            em, dm2 = st.mean(e), st.mean(dd)
            ese = math.hypot(st.stdev(e) / math.sqrt(len(e)) if len(e) > 1 else 0,
                             st.stdev(dd) / math.sqrt(len(dd)) if len(dd) > 1 else 0)
            rel = (dm2 / em - 1) * 100
            mark = "노이즈 이하" if abs(dm2 - em) < 2 * ese else f"±{2*ese/em*100:.1f}% 초과"
            print(f"    {'':4} {'└ E→D (영장 유무)':<22} "
                  f"{'':8} {'':6} {'':8}  {rel:+7.1f}% {mark:>12}")
        print()
    print("  '노이즈 이하' 는 오버헤드가 0 이라는 뜻이 아니라 이 표본으로는")
    print("  분해되지 않는다는 뜻이다. 상한으로만 읽고, 필요하면 --passes 를 늘린다.")
    print()


def _probe_files(d):
    out = defaultdict(dict)          # tier -> wl -> path
    for f in sorted(glob(os.path.join(d, "probe_*.json"))):
        base = os.path.basename(f)[len("probe_"):-len(".json")]
        tier, _, wl = base.partition("_")
        out[tier][wl or "(전체)"] = f
    return out


def micro_table(d):
    probes = _probe_files(d)
    if not probes:
        return
    print("── 마이크로: 훅 1회당 소요 (PROBE 빌드) ─────────────────────")
    print()
    print("  PROBE 빌드는 훅마다 bpf_ktime_get_ns() 를 두 번 부른다 — 티어 B 의")
    print("  숫자가 사실상 그 계측 비용이다. 절대값을 매크로 % 로 환산하지 말고")
    print("  티어 간 차이만 읽을 것. 카운터·히스토그램은 타이머 밖에 있다.")
    print()
    wls = sorted({w for m in probes.values() for w in m})
    for wl in wls:
        print(f"  {wl}")
        print(f"    {'':4} {'호출':>10} {'초당':>9} {'쓰기':>13} {'p50':>9} "
              f"{'p90':>9} {'p99':>10} {'p99.9':>11}")
        for tier in MICRO_TIERS:
            f = probes.get(tier, {}).get(wl)
            if not f:
                continue
            with open(f) as fh:
                j = json.load(fh)
            hist = {int(k): v for k, v in j["lat_log2_ns"].items()}
            total = sum(hist.values())
            c = j["counters"]
            opens = c.get("total", total) or total
            secs = j.get("seconds") or 1

            # 쓰기 비중은 dev 히스토그램에서 뽑는다. 판정 경로에서 뽑으면
            # 티어 B 는 그 코드가 없어서 구조적 0 이 측정된 0 처럼 보인다.
            dev = j["dev_major"]
            w = sum(x["write"] for x in dev.values())
            tot = sum(x["read"] + x["write"] for x in dev.values()) or opens

            def q(p):
                if not total:
                    return "—"
                need, acc = total * p, 0
                for b in sorted(hist):
                    acc += hist[b]
                    if acc >= need:
                        return f"{(1 << b) if b else 0}-{(1 << (b + 1)) - 1}"
                return "—"

            print(f"    {tier.upper():<4} {opens:>10,} {opens/secs:>8,.0f} "
                  f"{w:>6,} ({w/tot*100:4.1f}%) {q(.50):>9} {q(.90):>9} "
                  f"{q(.99):>10} {q(.999):>11}")
        # 태그 조회가 실제로 히트했는지. D 에서 0 이면 그 실행은 버린다.
        for tier in ("e", "d"):
            f = probes.get(tier, {}).get(wl)
            if not f:
                continue
            c = json.load(open(f))["counters"]
            print(f"      {tier.upper()} 판정: tag_hit={c.get('tag_hit',0):,} "
                  f"tag_miss={c.get('tag_miss',0):,} "
                  f"read={c.get('read',0):,} expired={c.get('expired',0):,}")
            if tier == "d" and not c.get("tag_hit"):
                print("      경고: tag_hit=0 — 태그가 안 심겼다. 이 D 숫자는 버릴 것")
            if tier == "e" and c.get("tag_hit"):
                print("      경고: E 인데 tag_hit>0 — 태그가 남아 있다. E·D 비교 무효")
        print()


def dev_table(d):
    probes = _probe_files(d)
    if not probes:
        return
    print("── dev major 분포 (ns 단위 아님, 호출 수) ───────────────────")
    print()
    print("  major 0 은 procfs·sysfs·tmpfs·cgroupfs·pipefs, 259 는 nvme 다.")
    print("  트래픽이 어디에 몰리든 superblock 으로 건너뛰지 않는다 —")
    print("  /proc/sys/kernel/* 쓰기와 /sys/fs/cgroup 조작이 통제 대상이다 (§15).")
    print()
    src = probes.get("d") or probes.get("c") or probes.get("b") or {}
    for wl, f in sorted(src.items()):
        with open(f) as fh:
            dev = json.load(fh)["dev_major"]
        rows = [(int(k), v["read"], v["write"]) for k, v in dev.items()]
        total = sum(r + w for _, r, w in rows)
        if not total:
            continue
        print(f"  {wl}")
        print(f"    {'major':>6} {'read':>11} {'write':>9} {'합':>11} {'비중':>7}")
        for mj, r, w in sorted(rows, key=lambda x: -(x[1] + x[2]))[:6]:
            s = r + w
            print(f"    {mj:>6} {r:>11,} {w:>9,} {s:>11,} {s/total*100:6.1f}%")
        print()


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    env = os.path.join(d, "env.txt")
    if os.path.exists(env):
        print(open(env).read())
    macro_table(d)
    micro_table(d)
    dev_table(d)
    print("판정 1: 매크로 Δ 가 한 자릿수 % 여야 한다.")
    print("      두 자릿수면 쓰기 통제를 inode_* 5종만으로 재설계한다 (CLAUDE.md S1).")
    print("        전부 '노이즈 이하' 면 통과가 아니라 미측정이다 — --passes 를 늘려")
    print("        상한을 좁히고, 그 상한을 결론으로 적는다.")
    print("판정 2: E→D 차이 = 영장 하나를 조회하는 값. §13 의 '영장 없는 프로세스는")
    print("        조회 한 번으로 빠져나간다'가 참이면 E 는 C 에 가깝고 D 만 더 낸다.")
    print("        E 가 D 만큼 비싸면 그 주장은 거짓이고, 무영장 세션이 많은")
    print("        현실 서버에서 오버헤드 추정이 통째로 틀어진다.")


if __name__ == "__main__":
    main()
