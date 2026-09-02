# §04 우회 경로 테스트 공통 헬퍼.
#
# 아직 warrantd 도 pam_warrant.so 도 없다. 그래서 "영장 세션"을 흉내 내는
# 방식은 이렇다: bats 프로세스 자신의 cgroup 을 태그하고, 거기서 자식을
# 만든다. systemd-logind 가 만드는 session-N.scope 와 성질이 같다 —
# 둘 다 cgroup 하나이고, 그 안에서 태어난 프로세스가 대상이다.
# S3(PAM 타이밍)이 끝나면 이 부분만 진짜 세션으로 갈아끼운다.

PROBE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE="$PROBE_DIR/tagprobe"
DAEMON_LOG="${BATS_FILE_TMPDIR:-/tmp}/tagprobe.log"

current_cgroup_id() {
    local cg
    cg=$(awk -F: '$1=="0"{print $3}' /proc/self/cgroup)
    stat -c %i "/sys/fs/cgroup${cg}"
}

start_probe() {
    [[ -x $PROBE ]] || { echo "tagprobe 가 없다. make" >&2; return 1; }
    mount | grep -q 'type bpf' || mount -t bpf bpf /sys/fs/bpf 2>/dev/null

    ( cd "$PROBE_DIR" && ./tagprobe daemon --tag-cgroup "$(current_cgroup_id)" ) \
        >"$DAEMON_LOG" 2>&1 &
    PROBE_PID=$!
    export PROBE_PID

    local i
    for i in $(seq 100); do
        grep -q '^READY' "$DAEMON_LOG" 2>/dev/null && return 0
        kill -0 "$PROBE_PID" 2>/dev/null || { cat "$DAEMON_LOG" >&2; return 1; }
        sleep 0.1
    done
    cat "$DAEMON_LOG" >&2
    return 1
}

stop_probe() {
    [[ -n ${PROBE_PID:-} ]] || return 0
    kill -INT "$PROBE_PID" 2>/dev/null || true
    wait "$PROBE_PID" 2>/dev/null || true
}

# 마커로 pid 를 찾는다. sudo · su · systemd-run 은 중간에 프로세스가
# 갈리므로 $! 를 믿을 수 없다. sleep 시간을 케이스마다 다르게 줘서
# 그 자체를 마커로 쓴다.
pid_of() {
    local marker=$1 i
    for i in $(seq 40); do
        local p
        p=$(pgrep -n -f -- "$marker" 2>/dev/null | head -1)
        [[ -n $p ]] && { echo "$p"; return 0; }
        sleep 0.05
    done
    return 1
}

probe_query() { "$PROBE" query "$1" 2>/dev/null; }

field() { sed -n "s/.*\b$2=\([^ ]*\).*/\1/p" <<< "$1"; }

# assert_tag <pid> <cg: yes|no> <task: yes|no>
# §04 표의 'cgroup' 열과 'fork 체인' 열을 각각 확인한다.
# 둘을 합쳐 "태그 유지"만 보면 systemd-run --scope 가 1차에 걸린 건지
# 2차 방어선에 걸린 건지 구분되지 않는다.
assert_tag() {
    local pid=$1 want_cg=$2 want_task=$3
    local out; out=$(probe_query "$pid")
    [[ -n $out ]] || { echo "pid=$pid 기록 없음 (exec 을 안 했나?)" >&2; return 1; }

    local cg task
    cg=$(field "$out" cg_tag); task=$(field "$out" task_tag)
    local got_cg=no got_task=no
    [[ ${cg:-0} != 0 ]] && got_cg=yes
    [[ ${task:-0} != 0 ]] && got_task=yes

    if [[ $got_cg != "$want_cg" || $got_task != "$want_task" ]]; then
        echo "기대: cgroup=$want_cg fork=$want_task" >&2
        echo "실제: cgroup=$got_cg fork=$got_task" >&2
        echo "  $out" >&2
        return 1
    fi
}

kill_marker() { pkill -f -- "$1" 2>/dev/null || true; }
