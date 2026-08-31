#!/usr/bin/env bash
# S1 — file_open 오버헤드 4단 측정
#
#   sudo ./run.sh                     기본 세트
#   sudo ./run.sh --runs 20           반복 수
#   sudo ./run.sh --workloads w_find,w_build
#   sudo ./run.sh --with-apt          apt 워크로드 포함 (네트워크 의존, 참고용)
#   sudo ./run.sh --out out/2026-08-31
#
# 4단:
#   A  훅 없음                          기준선
#   B  return 0 만                      LSM 훅 부착 자체의 비용
#   C  + f_mode & FMODE_WRITE 앞문      S0 실측 95% 가 여기서 끝난다
#   D  + cgroup 조회 · 맵 2회 · 시간 비교  나머지 5% 가 내는 비용
#
# 두 종류의 숫자를 뽑는다:
#   매크로  워크로드 벽시계. A 대비 몇 % 인가. 계측 없는 빌드로 잰다
#   마이크로 훅 1회당 소요 ns 의 분포. p99 는 여기서 나온다. PROBE 빌드로 잰다
# 매크로 반복은 20회 남짓이라 거기서 p99 를 뽑는 건 의미가 없다. 그래서 둘로 나눈다.

set -euo pipefail
cd "$(dirname "$0")"

RUNS=10
WARMUP=3
WITH_APT=0
OUT="out/$(date +%Y%m%d-%H%M%S)"
WORKLOADS="w_find,w_git,w_build,w_untar"
MICRO_WL="w_build"

while [[ $# -gt 0 ]]; do
    case $1 in
        --runs)      RUNS=$2; shift 2 ;;
        --warmup)    WARMUP=$2; shift 2 ;;
        --workloads) WORKLOADS=$2; shift 2 ;;
        --micro)     MICRO_WL=$2; shift 2 ;;
        --with-apt)  WITH_APT=1; shift ;;
        --out)       OUT=$2; shift 2 ;;
        *) echo "알 수 없는 인자: $1" >&2; exit 2 ;;
    esac
done
[[ $WITH_APT == 1 ]] && WORKLOADS="$WORKLOADS,w_apt"

# ── 사전 확인 ──────────────────────────────────────────────────────
die() { echo "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "root 로 돌려야 한다 (BPF LSM 부착)."
command -v hyperfine >/dev/null || die "hyperfine 이 없다. sudo apt install hyperfine"
grep -qw bpf /sys/kernel/security/lsm 2>/dev/null || \
    die "/sys/kernel/security/lsm 에 bpf 가 없다. sudo ../../deploy/enable-bpf-lsm.sh 후 재부팅."
[[ -x ./gate ]] || die "빌드가 안 돼 있다. make"
[[ -d fixtures/.done ]] || die "픽스처가 없다. ./fixture.sh"

mkdir -p "$OUT"

# 워크로드가 실행될 cgroup. 이걸 태그로 심어야 티어 D 가 조회 2회를 다 탄다.
# 안 심으면 전부 tag_miss 로 빠져서 "D 가 싸다"는 틀린 답이 나온다.
CG=$(awk -F: '$1=="0"{print $3}' /proc/self/cgroup)
CGID=$(stat -c %i "/sys/fs/cgroup${CG}" 2>/dev/null || echo 0)
[[ $CGID != 0 ]] || echo "경고: cgroup id 를 못 구했다 — 티어 D 는 miss 경로만 잰다" >&2

{
    echo "kernel   $(uname -r)"
    echo "lsm      $(cat /sys/kernel/security/lsm)"
    echo "cpu      $(nproc) x $(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo | xargs)"
    echo "cgroup   $CG (id=$CGID)"
    echo "runs     $RUNS (warmup $WARMUP)"
    echo "date     $(date -Is)"
} | tee "$OUT/env.txt"
echo

GATE_PID=""
gate_stop() {
    [[ -n $GATE_PID ]] || return 0
    kill -INT "$GATE_PID" 2>/dev/null || true
    wait "$GATE_PID" 2>/dev/null || true
    GATE_PID=""
}
trap 'gate_stop' EXIT

# gate 를 띄우고 READY 가 나올 때까지 기다린다.
# 이걸 안 기다리면 훅이 안 붙은 구간이 첫 워크로드에 섞인다.
gate_start() {
    local obj=$1 statsfile=$2 log=$3
    ./gate --obj "$obj" --tag-cgroup "$CGID" --out "$statsfile" >"$log" 2>&1 &
    GATE_PID=$!
    for _ in $(seq 100); do
        grep -q '^READY' "$log" 2>/dev/null && return 0
        kill -0 "$GATE_PID" 2>/dev/null || { cat "$log" >&2; die "gate 가 죽었다 ($obj)"; }
        sleep 0.1
    done
    cat "$log" >&2
    die "gate READY 타임아웃 ($obj)"
}

# ── 1단계: 매크로 (워크로드 벽시계) ─────────────────────────────────
echo "── 매크로: 워크로드 벽시계 ──────────────────────────────────"
IFS=, read -ra WLS <<< "$WORKLOADS"
for tier in a b c d; do
    if [[ $tier != a ]]; then
        gate_start "gate_${tier}.bpf.o" "$OUT/gate_${tier}.json" "$OUT/gate_${tier}.log"
    fi
    for wl in "${WLS[@]}"; do
        [[ -x workloads/$wl.sh ]] || die "워크로드 없음: workloads/$wl.sh"
        echo "  [$tier] $wl"
        hyperfine --style basic --warmup "$WARMUP" --runs "$RUNS" \
                  --export-json "$OUT/macro_${tier}_${wl}.json" \
                  "workloads/$wl.sh" >/dev/null
    done
    gate_stop
done

# ── 2단계: 마이크로 (훅 1회당 지연 분포 + dev major) ────────────────
# PROBE 빌드는 훅마다 bpf_ktime_get_ns() 를 두 번 부른다. 그 비용이 티어 B 가
# 내는 비용과 자릿수가 비슷하므로, 여기 숫자를 매크로 % 로 환산하지 말 것.
echo
echo "── 마이크로: 훅 지연 분포 · dev major ($MICRO_WL) ───────────"
for tier in b c d; do
    echo "  [$tier] $MICRO_WL"
    gate_start "gate_${tier}_probe.bpf.o" "$OUT/probe_${tier}.json" "$OUT/probe_${tier}.log"
    "workloads/$MICRO_WL.sh" >/dev/null 2>&1 || true
    gate_stop
done

echo
python3 report.py "$OUT" | tee "$OUT/report.txt"
# sudo 로 돌았으니 결과가 root 소유다. 그대로 두면 맥북으로 보내려고
# git add 할 때 걸린다.
# (set -e 아래에서 [[ ]] && cmd 는 조건이 거짓일 때 스크립트를 죽인다)
if [[ -n ${SUDO_USER:-} ]]; then chown -R "$SUDO_USER" "$OUT"; fi

echo
echo "결과: $OUT"
echo
echo "맥북으로 가져가기 (out/ 은 커밋 대상이다):"
echo "  git add $OUT && git commit -m \"S1 실측: $(uname -r)\" && git push"
