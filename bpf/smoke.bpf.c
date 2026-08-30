// Session Warrant — 툴체인 스모크 테스트
//
// 제품 코드가 아니다. 스파이크(S0)의 산출물이고, 확인하는 건 딱 하나:
// "clang 18 · libbpf · CO-RE · lsm=bpf 가 이 커널에서 실제로 같이 도는가."
//
// 그래서 제품이 의존하는 원시 능력 다섯 개만 건드린다:
//   ① lsm/file_open           강제 경로가 붙을 자리 (§15)
//   ② tp_btf/sched_process_fork  태그 2차 방어선 (§04)
//   ③ bpf_get_current_cgroup_id  태그 1차 — 이게 안 되면 제품이 없다 (§04)
//   ④ bpf_ktime_get_boot_ns      세션 안 만료 판정 (§05)
//   ⑤ CO-RE 로 file → (dev, ino) 읽기  대상 식별 (§15)
//
// 절대 -EPERM 을 리턴하지 않는다. 스파이크 전 구간은 감사 모드다 —
// 자기보호 6종(§16)을 붙이기 전에 차단을 켜면 자기 발을 쏜다.

#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_tracing.h>

char LICENSE[] SEC("license") = "GPL";

// vmlinux.h 에는 BTF 타입만 들어 있다. 매크로는 직접 적는다.
#define FMODE_WRITE 0x2

enum {
    ST_OPEN_TOTAL = 0,   // file_open 훅이 불린 횟수 — 오버헤드가 왜 위험한지 여기서 보인다
    ST_OPEN_WRITE = 1,   // 그중 쓰기 의도만 — §15 가 "쓰기만 판정한다"고 한 근거
    ST_FORK       = 2,
    ST_MAX
};

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, ST_MAX);
    __type(key, __u32);
    __type(value, __u64);
} stats SEC(".maps");

// 마지막으로 본 값 하나. 로더가 읽어서 "정말 읽혔는지" 눈으로 확인하는 용도다.
struct sample {
    __u64 cgroup_id;
    __u64 boot_ns;
    __u64 ino;
    __u32 dev;
    __u32 pid;
    __u8  write;
    __u8  _pad[7];
};

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, struct sample);
} last SEC(".maps");

static __always_inline void bump(__u32 k)
{
    __u64 *v = bpf_map_lookup_elem(&stats, &k);
    if (v)
        __sync_fetch_and_add(v, 1);
}

SEC("lsm/file_open")
int BPF_PROG(smoke_file_open, struct file *file)
{
    bump(ST_OPEN_TOTAL);

    // ⑤ CO-RE. 경로가 아니라 (dev, ino) 로 식별한다 — 경로는 mv 로 흔들린다
    __u64 ino = BPF_CORE_READ(file, f_inode, i_ino);
    __u32 dev = BPF_CORE_READ(file, f_inode, i_sb, s_dev);
    __u32 mode = BPF_CORE_READ(file, f_mode);
    __u8  w = (mode & FMODE_WRITE) ? 1 : 0;

    if (w)
        bump(ST_OPEN_WRITE);

    __u32 z = 0;
    struct sample *s = bpf_map_lookup_elem(&last, &z);
    if (s) {
        s->cgroup_id = bpf_get_current_cgroup_id();   // ③
        s->boot_ns   = bpf_ktime_get_boot_ns();       // ④
        s->ino   = ino;
        s->dev   = dev;
        s->pid   = bpf_get_current_pid_tgid() >> 32;
        s->write = w;
    }

    return 0;   // 언제나 허용. 여기를 -EPERM 으로 바꾸지 말 것
}

// ② 태그 2차 방어선이 붙을 자리. 지금은 세기만 한다.
SEC("tp_btf/sched_process_fork")
int BPF_PROG(smoke_fork, struct task_struct *parent, struct task_struct *child)
{
    bump(ST_FORK);
    return 0;
}
