# Session Warrant

SSH 세션에 범위·유효기간을 가진 **영장(warrant)** 을 붙이고, 그 영장을 셸이 아니라 **커널(eBPF LSM)** 이 집행하는 서버 접근통제 제품.
기존 게이트웨이/프록시형 SSH 접근제어(Teleport, StrongDM 등)가 못 하는 "문을 통과한 다음"을 통제한다.

**현재 상태: 요구사항 골격.** `docs/` 의 기획 문서 2종이 설계 원본이고, `server/` 에 warrant-server 클래스 골격이 있다(시그니처 + 의사코드 주석, 본문 미구현). 나머지 계층은 디렉터리와 각 디렉터리의 `README.md`(무엇이 들어가고 무엇을 지켜야 하는지)만 있고 코드는 아직 없다.

- `docs/session-warrant-plan.html` — 개념·기획·아키텍처 통합본 (r09, 2026-08-15). 절 번호(§01~§19)로 참조된다.
- `docs/session-warrant-tech-stack.html` — 기술 스택 선택과 근거 (2026-08-19).

두 문서는 서로를 절 번호로 상호 참조한다. 설계 관련 판단이 필요하면 추측하지 말고 해당 절을 먼저 읽을 것.

## 핵심 개념 (여기서 벗어나면 제품이 아니다)

- **영장은 cgroup에 붙는다.** systemd-logind가 만드는 `session-N.scope` 의 cgroup id에 걸어서 `sudo`·`su` 로 uid가 바뀌어도 표식이 유지된다. 2차 방어선으로 `sched_process_fork` 에서 부모 태그를 자식 task_storage에 복사한다. 이 두 겹이 성립하지 않으면 제품 전체가 성립하지 않는다 (§04).
- **만료가 세션 안에서 발효된다.** LSM 훅이 매 판정마다 `bpf_ktime_get_boot_ns()` 와 `expires_ns` 를 비교한다. 유저 공간 왕복도, 타이머도, 프로세스 순회도 없다. 취소는 `revoked` 1바이트 (§05, §12).
- **판정 시점에 유저 공간으로 올라가지 않는다.** 중앙 → warrantd → BPF 맵에서 흐름이 끝나고, 그 뒤로는 커널이 혼자 판정한다. 중앙이 끊겨도, warrantd가 죽어도 이미 발급된 영장의 집행은 계속된다 (§10, §17).
- **읽기는 통제하지 않는다.** `file_open` 오버헤드 때문에 쓰기·삭제·이름변경만 판정하고, 그 대가는 아웃바운드 전면 차단으로 메운다 (§15).
- **경로가 아니라 `(dev, ino)` 쌍으로 식별한다.** 허용 목록은 파일 inode로 충분하지만 **금지 목록은 반드시 디렉터리 inode** 로 걸어야 한다 — 파일 inode 금지는 `mv` 후 재생성으로 뚫린다 (§15).
- **감사 모드와 강제 모드가 판정 함수를 공유한다.** `static __always_inline` 판정 함수 하나를 `lsm/*` 과 `kprobe/security_*` 이 각각 호출한다. "감사에서는 안 걸렸는데 강제로 켜니 막히더라"가 구조적으로 생기지 않아야 한다 (§15).
- **fail 방향이 비대칭이다.** 강제 경로(커널)는 단단하게 실패하고, 발급 경로(PAM·중앙)는 느슨하게 실패한다. PAM이 warrantd에 못 붙으면 **로그인을 허용**하고 무영장 세션으로 기록·경보한다. 여기서 fail-close를 택하면 장애 때 아무도 못 들어간다 (§17).

## 기술 스택 (버전 고정 — 임의로 올리지 말 것)

| 계층 | 언어 | 핵심 의존성 |
|---|---|---|
| BPF 프로그램 | C | libbpf · vmlinux.h · clang/LLVM 18+ · CO-RE |
| 노드 에이전트 `warrantd` | Go 1.25+ | cilium/ebpf v0.22 · bpf2go · grpc-go · bbolt · x/sys/unix |
| PAM 모듈 | C | libpam-dev |
| 중앙 서버 | Java 25 (LTS) | Spring Boot 4.1.1 · Security(OIDC) · Data JPA · Flyway · `spring-boot-starter-grpc-server` |
| DB | — | PostgreSQL 18 (감사 이벤트는 선언적 파티셔닝) |
| 대시보드 | TypeScript | React 19 · Vite — 또는 Grafana로 대체 |

개발 커널 6.8(Ubuntu 24.04) / 검증 7.0(Ubuntu 26.04) · Rocky 9 호환 검증.
개발은 **물리 서브 PC 한 대**(Ubuntu 24.04.4 / 6.8.0)에서 한다 — 편집은 macOS, 빌드·실행·측정은 서브 PC, 동기화는 GitHub. VM 층을 끼우면 커널 문제와 가상화 문제를 매번 구분해야 한다. 3노드 구성은 중앙 서버가 붙는 시점에 꺼낸다.
중앙 서버는 Spring Web MVC + 가상 스레드(WebFlux 불필요) · Testcontainers + JUnit 5 · Ed25519는 JDK 내장.

**Spring Boot 4는 스타터 이름이 Boot 3과 다르다.** `spring-boot-starter-web` → `-webmvc`, oauth2 스타터 → `spring-boot-starter-security-oauth2-*`, Flyway는 전용 스타터, gRPC는 Boot가 spring-grpc를 흡수해 `spring-boot-starter-grpc-server`가 됐다 (`org.springframework.grpc` 스타터는 1.0.3에서 멈췄으니 그 BOM을 import하지 말 것). Boot 3 예제를 그대로 옮기면 "Could not find ..."로 실패한다.

언어가 넷인 것은 제약이다: BPF는 C만 되고, PAM은 sshd 주소 공간에 dlopen되므로 Go 런타임을 넣을 수 없고, 중앙은 Java로 정해져 있다. Rust(aya)가 아니라 Go인 이유는 성능이 아니라 **막혔을 때 검색으로 풀리는가**다.

## 리포지토리 구조 (모노레포 — `server/` 외에는 디렉터리 골격만)

```
proto/    protobuf 스키마 — 팀 간 계약. 가장 먼저 확정한다
bpf/      C · BPF 프로그램 (vmlinux.h는 gitignore, 커밋하지 않는다)
agent/    Go · warrantd
          cmd/warrantd/ · internal/{loader,bpfmap,pamsock,policy,ringbuf,upstream,store}/ · bpf/(bpf2go 생성물, 커밋한다)
pam/      C · pam_warrant.so (200줄 이내로 유지)
server/   Java · Spring Boot  ← 골격 있음
web/      대시보드 (Grafana 대체 가능)
deploy/   bootstrap.sh · enable-bpf-lsm.sh · systemd/ · ansible/
bench/    bypass/(§04 우회 경로 = bats 케이스) · overhead/(훅별 실측)
```

각 디렉터리의 `README.md` 에 그 계층이 지켜야 할 제약이 적혀 있다. 작업 전에 해당 README 를 먼저 읽을 것.

## 작업 규칙

- **`proto/warrant.proto` 가 단일 진실 원본이다.** `struct warrant` 의 필드, 서버 엔티티, BPF 맵 값이 모두 같은 `.proto` 에서 나와야 한다. 커널 구조체와 서버 엔티티가 어긋나면 디버깅이 지옥이 된다.
- **훅은 한 번에 하나씩 붙인다.** 순서: `sched_process_fork` → `bprm_check_security` → `socket_connect` → `file_open` → `inode_{create,unlink,rename,link,symlink}`(5개 한 세트) → 자기보호 6종 → `socket_sendmsg` → `kprobe/security_*` 미러. 훅 하나마다 verifier 통과와 오버헤드를 같이 확인한다.
- **자기 보호 6종은 정책이 아니라 제품이 강제 삽입하는 기본 규칙이다** (`lsm/bpf`, `task_kill`, `sb_umount`, `ptrace_access_check`, `kernel_module_request`, warrantd 자기 파일 쓰기 금지). 영장 작성자가 실수로 열 수 없어야 하고, 하나라도 빠지면 나머지가 무의미하다 (§16).
- **BPF 프로그램과 맵은 bpffs에 pin한다.** warrantd 재시작 중에도 태깅 공백이 생기면 안 된다. systemd 유닛에 `Before=sshd.service` 는 필수다 — 없으면 부팅 직후 세션이 태그 없이 시작된다.
- **PAM 스택에서 `pam_warrant.so` 는 `pam_systemd.so` 뒤에 온다.** 그 전에는 `session-N.scope` 가 아직 없다. `/etc/pam.d/sshd` 를 건드리는 작업은 VM 콘솔 접근 경로를 확보한 상태에서만 한다.
- **서명은 protobuf 직렬화 바이트에 한다.** JSON 서명은 키 순서·공백 정규화 문제를 만든다. Ed25519는 JDK 내장을 쓴다(BouncyCastle 불필요).
- **`bench/` 는 초기 구조에 넣는다.** §04의 우회 경로 표가 그대로 bats 테스트 케이스다. §18이 인정한 4가지 구멍(만료 전 열어둔 fd, connect 없는 UDP, 데몬 위임, `kubectl exec`)도 **skip 사유를 명시해 실패 테스트로 커밋**한다 — "알고 있으나 막지 못한다"와 "모른다"는 다르게 취급된다.
- **감사 기록은 절제한다.** 차단은 전건 기록, 허용은 `exec`·`connect` 처럼 빈도 낮은 것만. 쓰기 허용까지 다 남기면 ringbuf가 넘친다. 유실 구간은 반드시 명시적으로 기록해 "빈 구간"을 숨기지 않는다 (§13, §14).
- **정책 컴파일러는 실행 허용 목록과 쓰기 허용 목록의 조합을 경고해야 한다.** 예: `systemctl` 실행 허용 + `/etc/systemd/system` 쓰기 허용 = 임의 코드 실행 경로 (§04).

## 표현 주의

- ✗ "모든 명령을 기록합니다" — `cd` 한 번이면 반증된다(셸 빌트인은 exec이 없다).
- ✓ "실행된 모든 프로세스를 사람에게 귀속시켜 기록합니다."
- argv는 1급 증거가 아니다(`exec -a` 로 위조 가능 + BPF 스택 제약으로 잘림). 신뢰 근거는 커널이 실제로 연 바이너리의 inode다 (§14).
- 이 제품은 "root를 없애는 제품"이 아니라 "root가 하는 일에 사유와 기한을 붙이는 제품"이다. 커널 익스플로잇·부팅 경로 장악 앞에서는 무의미하다 (§06).

## 환경 사전 확인

```sh
cat /sys/kernel/security/lsm   # 출력에 bpf 가 없으면 강제 모드는 한 줄도 못 짠다
```

없으면 `/etc/default/grub` 의 `GRUB_CMDLINE_LINUX_DEFAULT` 에 **기존 목록 뒤에 `,bpf` 를 덧붙여** 넣고 `update-grub` 후 재부팅한다. `lsm=bpf` 만 단독으로 넣으면 AppArmor가 빠지면서 부팅이 깨질 수 있다.

## 다음 단계 — 스파이크가 먼저다

기획서 §09 가 선행 검증 셋을 지목했다: PAM 에서 session scope 가 확정되는 타이밍 ·
**`file_open` 훅의 실측 오버헤드** · inode 갱신 추적의 안정성. **이 중 둘째가 가장 위험하므로 PoC 는 여기서 시작한다.**

스파이크는 던져버리는 코드다. 남기는 건 `bench/` 의 측정 하네스와 bats 케이스뿐이다.
**`proto/warrant.proto` 는 스파이크 뒤에 쓴다** — 커널이 실제로 뭘 필요로 하는지 모르는 상태에서
단일 진실 원본을 확정하면, 세 계층이 다 그 위에 붙은 뒤에 고치게 된다.

| | 스파이크 | 판정 | 실패하면 |
|---|---|---|---|
| S0 | 환경 — `bootstrap.sh` · `enable-bpf-lsm.sh` · `bpf/smoke` | 스모크가 attach 된다 | 개발 환경을 옮긴다 |
| S1 | **`file_open` 오버헤드** — 훅없음/빈훅/판정훅 3단 비교, p99 까지 | 한 자릿수 % | 쓰기 통제를 `inode_*` 5종만으로 재설계 |
| S2 | 태그 두 겹 — cgroup + fork 전파, §04 표 = bats | 앞 3줄 초록, 뒤 2줄 명시적 실패 | **제품을 다시 정의한다** |
| S3 | PAM 타이밍 — 로그만 찍는 20줄 모듈 | scope 가 이미 존재 | warrantd 가 cgroup 트리 순회 (태깅 공백 측정) |
| S4 | inode 안정성 — upgrade · vim 저장 · logrotate | 재컴파일 지점 목록화 | fanotify 범위 확대 |

그 뒤가 §09 MVP: 감사 모드 2개월 → 영장 없는 접속 탐지 +1개월 → 강제 +2개월 · 승인 연동 병행.

**스파이크 전 구간은 감사 모드다.** LSM 훅은 `return 0` 만 한다 — 자기보호 6종을 붙이기 전에
`-EPERM` 을 켜면 verifier 를 통과한 버그 하나로 자기 박스에서 잠긴다.
