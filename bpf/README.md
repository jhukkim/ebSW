# bpf/

C · BPF 프로그램. libbpf + CO-RE, clang/LLVM 18+.
**판정은 전부 여기서 끝난다.** 유저 공간 왕복도, 타이머도, 프로세스 순회도 없다 (§05, §10).

## 들어갈 것

| 파일 | 내용 |
|---|---|
| `warrant.bpf.h` | `struct warrant` · 맵 정의 · `static __always_inline` 판정 함수 |
| `warrant.bpf.c` | LSM 훅 본체 |
| `warrant_mirror.bpf.c` | `kprobe/security_*` 미러 (감사 모드) |
| `vmlinux.h` | **커밋하지 않는다** — `.gitignore` 에 있다 |

```sh
# 개발 VM 에서 한 번
bpftool btf dump file /sys/kernel/btf/vmlinux format c > bpf/vmlinux.h

clang -O2 -g -target bpf -D__TARGET_ARCH_x86 -c bpf/warrant.bpf.c -o bpf/warrant.bpf.o
```

## 규칙

- **훅은 한 번에 하나씩 붙인다.** 순서는 CLAUDE.md 참조. 훅 하나마다 verifier 통과와 오버헤드를 같이 확인한다.
- **감사 모드와 강제 모드가 판정 함수를 공유한다.** `static __always_inline` 하나를
  `lsm/*` 과 `kprobe/security_*` 이 각각 호출한다. "감사에선 안 걸렸는데 강제로 켜니 막히더라"가
  구조적으로 생기면 안 된다 (§15).
- **자기 보호 6종은 정책이 아니다.** 제품이 강제 삽입한다 — `lsm/bpf` · `task_kill` · `sb_umount` ·
  `ptrace_access_check` · `kernel_module_request` · warrantd 자기 파일 쓰기 금지 (§16).
- 대상 식별은 `(dev, ino)` 쌍. **금지 목록은 반드시 디렉터리 inode** — 파일 inode 금지는 `mv` 후 재생성으로 뚫린다 (§15).
- 시간은 `bpf_ktime_get_boot_ns()`. `bpf_ktime_get_ns()` 는 suspend 구간을 빼먹는다.
- 맵과 프로그램은 bpffs 에 pin 한다. warrantd 재시작 중 태깅 공백이 생기면 안 된다.
- **모든 타입 이름에 접두사를 붙인다** (`warrant_*`). `vmlinux.h` 는 커널의 전체 타입을
  통째로 들여오므로 흔한 이름은 그냥 충돌한다 — `struct sample` · `struct event` ·
  `struct task` · `struct config` 는 전부 커널에 이미 있다.
  증상은 `error: redefinition of '...'` 뒤에 따라오는 "no member named" 무더기다.

뽑아내는 값의 전체 목록: `docs/session-warrant-ebpf-fields.html`.
