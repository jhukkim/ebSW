#!/usr/bin/env python3
"""S1 결과를 표로 찍는다.

  python3 report.py out/20260831-120000

매크로는 A 대비 %, 마이크로는 훅 1회당 ns 분포다.
두 숫자를 곱하거나 환산하지 말 것 — PROBE 빌드는 계측 비용을 포함한다.
"""
import json
import os
import sys
from glob import glob

TIERS = ["a", "b", "c", "d"]
TIER_DESC = {
    "a": "훅 없음",
    "b": "return 0 만",
    "c": "+ FMODE_WRITE 앞문",
    "d": "+ cgroup·맵2회·시간",
}


def pct(sorted_vals, q):
    if not sorted_vals:
        return float("nan")
    i = min(len(sorted_vals) - 1, int(round(q * (len(sorted_vals) - 1))))
    return sorted_vals[i]


def load_macro(d):
    out = {}
    for f in glob(os.path.join(d, "macro_*.json")):
        base = os.path.basename(f)[len("macro_"):-len(".json")]
        tier, wl = base.split("_", 1)
        with open(f) as fh:
            r = json.load(fh)["results"][0]
        out.setdefault(wl, {})[tier] = sorted(r["times"])
    return out


def macro_table(d):
    data = load_macro(d)
    if not data:
        return
    print("── 매크로: 워크로드 벽시계 (A 대비) ─────────────────────────")
    print()
    for wl in sorted(data):
        t = data[wl]
        n = len(next(iter(t.values()), []))
        base = t.get("a")
        print(f"  {wl}   (runs={n})")
        print(f"    {'':4} {'설명':<22} {'mean':>9} {'p95':>9} {'max':>9} "
              f"{'Δmean':>8} {'Δp95':>8}")
        for tier in TIERS:
            v = t.get(tier)
            if not v:
                continue
            m, p95, mx = sum(v) / len(v), pct(v, 0.95), v[-1]
            if base and tier != "a":
                bm = sum(base) / len(base)
                dm = f"{(m / bm - 1) * 100:+7.1f}%"
                dp = f"{(p95 / pct(base, 0.95) - 1) * 100:+7.1f}%"
            else:
                dm = dp = "     — "
            print(f"    {tier.upper():<4} {TIER_DESC[tier]:<22} "
                  f"{m:8.3f}s {p95:8.3f}s {mx:8.3f}s {dm:>8} {dp:>8}")
        print()
    print("  반복이 수십 회라 여기서 p99 를 뽑는 건 의미가 없다. p99 는 아래 마이크로에 있다.")
    print()


def micro_table(d):
    files = sorted(glob(os.path.join(d, "probe_*.json")))
    if not files:
        return
    print("── 마이크로: 훅 1회당 소요 (PROBE 빌드) ─────────────────────")
    print()
    print("  PROBE 빌드는 훅마다 bpf_ktime_get_ns() 를 두 번 부른다.")
    print("  그 비용이 티어 B 가 내는 비용과 자릿수가 비슷하다 — 절대값을")
    print("  매크로 % 로 환산하지 말고, 티어 간 '차이'만 읽을 것.")
    print()
    print(f"    {'':4} {'호출':>12} {'쓰기':>14} {'p50':>8} {'p90':>8} "
          f"{'p99':>8} {'p99.9':>8}")
    for f in files:
        tier = os.path.basename(f)[len("probe_"):-len(".json")]
        with open(f) as fh:
            j = json.load(fh)
        hist = {int(k): v for k, v in j["lat_log2_ns"].items()}
        total = sum(hist.values())
        c = j["counters"]

        def q(p):
            if not total:
                return "—"
            need, acc = total * p, 0
            for b in sorted(hist):
                acc += hist[b]
                if acc >= need:
                    lo, hi = (1 << b) if b else 0, (1 << (b + 1)) - 1
                    return f"{lo}-{hi}"
            return "—"

        opens = c["open_total"] or total
        w = c["open_write"]
        wr = f"{w} ({w / opens * 100:.1f}%)" if opens else str(w)
        print(f"    {tier.upper():<4} {opens:>12,} {wr:>14} "
              f"{q(.50):>8} {q(.90):>8} {q(.99):>8} {q(.999):>8}   ns")
    print()
    for f in files:
        tier = os.path.basename(f)[len("probe_"):-len(".json")]
        with open(f) as fh:
            j = json.load(fh)
        c = j["counters"]
        if c["tag_hit"] or c["tag_miss"]:
            print(f"    {tier.upper()}: tag_hit={c['tag_hit']:,} "
                  f"tag_miss={c['tag_miss']:,} expired={c['expired']:,}")
    print()


def dev_table(d):
    # 가장 정보가 많은 티어(D) 의 PROBE 결과를 쓴다.
    for tier in ("d", "c", "b"):
        f = os.path.join(d, f"probe_{tier}.json")
        if os.path.exists(f):
            break
    else:
        return
    with open(f) as fh:
        dev = json.load(fh)["dev_major"]
    if not dev:
        return
    rows = [(int(k), v["read"], v["write"]) for k, v in dev.items()]
    total = sum(r + w for _, r, w in rows)
    if not total:
        return
    print("── dev major 분포 ───────────────────────────────────────────")
    print()
    print("  major 0 은 procfs·sysfs·tmpfs·cgroupfs·pipefs 다. 트래픽 대부분이")
    print("  여기라고 해서 superblock 으로 건너뛰면 안 된다 —")
    print("  /proc/sys/kernel/* 쓰기와 /sys/fs/cgroup 조작이 정확히 통제 대상이다 (§15).")
    print()
    print(f"    {'major':>6} {'read':>12} {'write':>10} {'합':>12} {'비중':>7}")
    for mj, r, w in sorted(rows, key=lambda x: -(x[1] + x[2]))[:12]:
        s = r + w
        print(f"    {mj:>6} {r:>12,} {w:>10,} {s:>12,} {s / total * 100:6.1f}%")
    print()


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    env = os.path.join(d, "env.txt")
    if os.path.exists(env):
        print(open(env).read())
    macro_table(d)
    micro_table(d)
    dev_table(d)
    print("판정 기준: 매크로 Δ 가 한 자릿수 % 여야 한다.")
    print("두 자릿수면 쓰기 통제를 inode_* 5종만으로 재설계한다 (CLAUDE.md S1).")


if __name__ == "__main__":
    main()
