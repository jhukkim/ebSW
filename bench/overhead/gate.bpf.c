// S1 — file_open 오버헤드 4단 측정
//
// 티어는 파일이 아니라 컴파일 타임 상수다. C 는 B 에 한 줄 더한 것이고
// D 는 C 에 조회를 더한 것이라는 관계가 소스에 그대로 보여야 한다.
// 파일 넷으로 쪼개면 티어끼리 슬금슬금 달라져도 아무도 모른다.
//
//   TIER=1  (B) 훅만 붙이고 return 0
//   TIER=2  (C) + f_mode & FMODE_WRITE 앞문      ← S0 실측 95% 가 여기서 끝난다
//   TIER=3  (D) + cgroup 조회 · 맵 2회 · 시간 비교
//   (A 는 훅이 없는 상태 = 로더를 안 띄운다. 오브젝트가 없다)
//
//   PROBE=0  계측 없음. 매크로(워크로드 벽시계) 측정용
//   PROBE=1  + 지연 히스토그램 · dev major 히스토그램 · 카운터
//
// PROBE=1 은 훅마다 bpf_ktime_get_ns() 를 두 번 부른다. 그 비용이 티어 B 가
// 내는 비용과 자릿수가 비슷하다. 그래서 매크로 숫자와 마이크로 숫자는
// 반드시 다른 빌드에서 뽑는다. 같은 실행에서 둘 다 얻으려 하면 둘 다 틀린다.

#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_tracing.h>

char LICENSE[] SEC("license") = "GPL";

// vmlinux.h 에는 BTF 타입만 들어 있다. 매크로는 직접 적는다.
#define FMODE_WRITE 0x2
#define OH_MAJOR(dev) ((dev) >> 20)

#ifndef TIER
#define TIER 1
#endif
#ifndef PROBE
#define PROBE 0
#endif

// 타입 접두사 oh_* — vmlinux.h 는 커널의 모든 타입을 통째로 들여온다.
// 제품 코드는 warrant_*, 이 벤치는 oh_*.
struct oh_warrant {
    __u64 expires_ns;      // boot 기준. 유저 공간 시각이 아니다
    __u8  revoked;
    __u8  _pad[7];
};

enum {
    OH_OPEN_TOTAL = 0,
    OH_OPEN_WRITE,         // 앞문을 통과한 것 = S0 의 4.7%
    OH_TAG_HIT,
    OH_TAG_MISS,
    OH_EXPIRED,
    OH_CNT_MAX
};

// ── 맵 ─────────────────────────────────────────────────────────────
// 전부 PERCPU 다. S0 의 smoke 는 평범한 ARRAY + __sync_fetch_and_add 를 썼는데,
// 그건 한 캐시라인을 모든 CPU 가 두들기는 구조다. -P8 병렬 워크로드에서는
// 그 경합 자체가 측정값이 되어버린다. 세는 게 목적이면 PERCPU 여야 한다.
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, OH_CNT_MAX);
    __type(key, __u32);
    __type(value, __u64);
} oh_counters SEC(".maps");

// 판정 함수 자체의 소요 시간, log2(ns) 버킷. p99 는 여기서 나온다.
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 64);
    __type(key, __u32);
    __type(value, __u64);
} oh_lat SEC(".maps");

// dev major 별 · 읽기/쓰기별 분포. index = major * 2 + write
// "왜 95% 를 안 걸렀나" 를 나중에 설명하려면 이 표가 있어야 한다.
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 512);
    __type(key, __u32);
    __type(value, __u64);
} oh_dev SEC(".maps");

// 1차 태그: cgroup id → warrant id (§04)
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 4096);
    __type(key, __u64);
    __type(value, __u64);
} oh_tag SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 4096);
    __type(key, __u64);
    __type(value, struct oh_warrant);
} oh_warrants SEC(".maps");

// ── 계측 보조 ──────────────────────────────────────────────────────
#if PROBE
static __always_inline void oh_bump(__u32 k)
{
    __u64 *v = bpf_map_lookup_elem(&oh_counters, &k);
    if (v)
        (*v)++;            // PERCPU 라 원자연산이 필요 없다
}

static __always_inline __u32 oh_log2(__u64 v)
{
    __u32 r = 0, s;
#pragma unroll
    for (int i = 5; i >= 0; i--) {
        s = 1u << i;
        if (v >> s) { v >>= s; r += s; }
    }
    return r;
}

static __always_inline void oh_record(__u64 ns)
{
    __u32 k = oh_log2(ns);
    if (k >= 64)
        k = 63;
    __u64 *v = bpf_map_lookup_elem(&oh_lat, &k);
    if (v)
        (*v)++;
}
#endif /* PROBE */

// ── 판정 함수 ──────────────────────────────────────────────────────
// 감사 모드와 강제 모드가 공유하게 될 함수의 자리다 (§15).
// 스파이크 전 구간에서 반환값은 언제나 0 이다. 여기를 -EPERM 으로 바꾸지 말 것 —
// 자기보호 6종 전에 켜면 verifier 를 통과한 버그 하나로 자기 박스에서 잠긴다.
static __always_inline int oh_decide(struct file *file)
{
#if TIER >= 2
    // 앞문. S0 에서 쓰기 의도는 전체 file_open 의 4.7% 였다(123/2,598).
    // 비트 테스트 하나가 95% 를 여기서 끝낸다. 맵 조회까지 가는 건 5% 다.
    __u32 mode = BPF_CORE_READ(file, f_mode);
    if (!(mode & FMODE_WRITE))
        return 0;
#if PROBE
    oh_bump(OH_OPEN_WRITE);
#endif
#endif /* TIER >= 2 */

#if TIER >= 3
    // 나머지 5% 가 내는 비용: cgroup 조회 1 + 해시 조회 2 + 시간 비교 1
    __u64 cg = bpf_get_current_cgroup_id();
    __u64 *wid = bpf_map_lookup_elem(&oh_tag, &cg);
    if (!wid) {
#if PROBE
        oh_bump(OH_TAG_MISS);
#endif
        return 0;                          // 무영장 세션 — 감사 모드에서는 통과
    }
    struct oh_warrant *w = bpf_map_lookup_elem(&oh_warrants, wid);
    if (!w)
        return 0;
#if PROBE
    oh_bump(OH_TAG_HIT);
#endif
    if (w->revoked)
        return 0;                          // 강제 모드였다면 -EPERM
    // 만료가 세션 안에서 발효된다 (§05·§12). 유저 공간 왕복도 타이머도 없다.
    if (bpf_ktime_get_boot_ns() > w->expires_ns) {
#if PROBE
        oh_bump(OH_EXPIRED);
#endif
        return 0;                          // 강제 모드였다면 -EPERM
    }
#endif /* TIER >= 3 */

    (void)file;
    return 0;
}

// ── 훅 ─────────────────────────────────────────────────────────────
SEC("lsm/file_open")
int BPF_PROG(oh_file_open, struct file *file)
{
#if PROBE
    __u64 t0 = bpf_ktime_get_ns();
#endif

    int r = oh_decide(file);

#if PROBE
    oh_record(bpf_ktime_get_ns() - t0);
    oh_bump(OH_OPEN_TOTAL);

    __u32 dev = BPF_CORE_READ(file, f_inode, i_sb, s_dev);
    __u32 mj  = OH_MAJOR(dev);
    if (mj > 255)
        mj = 255;
    __u32 mode = BPF_CORE_READ(file, f_mode);
    __u32 k = mj * 2 + ((mode & FMODE_WRITE) ? 1 : 0);
    __u64 *v = bpf_map_lookup_elem(&oh_dev, &k);
    if (v)
        (*v)++;
#endif
    return r;
}
