# bench/bypass/ — S2: 태그 두 겹이 프로세스 트리를 따라가는가

**§04 의 표가 그대로 테스트 케이스다.** 기술스택 문서는 이걸 두고
*"심사에서 가장 강한 카드가 이것이다"* 라고 적었다. 표의 각 행을 bats 케이스
하나로 옮기면, 그 표는 주장이 아니라 **실행 가능한 증거**가 된다.

S1(`file_open` 오버헤드)이 실패하면 쓰기 통제를 재설계하면 되지만,
**S2 가 실패하면 제품을 다시 정의해야 한다.** 위험 크기는 이쪽이 더 크다.

## 세 열을 각각 잰다

태그가 붙었다/안 붙었다만 보면 안 된다. `systemd-run --scope`(cgroup 은
바뀌었지만 fork 체인이 살아 **2차 방어선**에 걸린 경우)와 `nohup`(1차에
걸린 경우)이 구분되지 않는다. 그래서 `tagprobe` 는 두 겹을 따로 기록한다.

| §04 표의 열 | 여기서 읽는 값 |
|---|---|
| cgroup | `cg_tag` — 1차(cgroup id) 조회 결과 |
| fork 체인 | `task_tag` — 2차(`sched_process_fork` 전파) 조회 결과 |
| 태그 | 둘 중 하나라도 0 이 아니면 유지 |

## 표와 케이스

| §04 행 | cgroup | fork | 케이스 |
|---|---|---|---|
| `nohup` · `setsid` · `&` | 유지 | 유지 | §04-1 (3건) |
| `sudo` · `su` | 유지 | 유지 | §04-2 (2건) |
| `systemd-run --scope` | **바뀜** | 유지 | §04-3 ← 2차 방어선의 존재 이유 |
| `systemd-run` (기본) | 바뀜 | 끊김 | §04-4 |
| `systemctl start` | 바뀜 | 끊김 | §04-5 (skip, §04-4 와 같은 경로) |
| `at` · `crontab` | 바뀜 | 끊김 | §04-6 |
| `docker exec` | 바뀜 | 끊김 | §04-7 |

**앞 3줄(6건)이 초록이어야 제품이 성립한다.** 뒤 4줄은 문서가 인정한 위임
경로이고, **"끊긴다"는 것 자체가 검증 대상**이다 — 실패가 아니라 예상된
결과다. 그 경로들의 진짜 방어선(실행 화이트리스트 · AF_UNIX 소켓 차단 ·
spool 쓰기 차단)은 셋 다 아직 구현 전이라 `§04 위임-1~3` 에 skip 으로
명시해 뒀다.

## 실패하는 테스트도 커밋한다

`known_holes.bats` 는 §18 이 인정한 네 구멍 — 만료 전 열어둔 fd, connect
없는 UDP, 데몬 위임, `kubectl exec` — 을 전부 skip 사유와 함께 담는다.

> **"알고 있으나 막지 못한다"와 "모른다"는 심사에서 완전히 다르게 취급되고,
> 그 차이를 코드로 증명하는 방법이 이것이다.**

넷 다 감사 모드에서는 **기록은 된다.** 막지 못할 뿐 보이지 않는 건 아니다 —
이 구분이 제품 설명에서 중요하다 (§18).

## 지금은 세션을 흉내 낸다

아직 `warrantd` 도 `pam_warrant.so` 도 없다. 그래서 "영장 세션"은 이렇게
만든다: **bats 프로세스 자신의 cgroup 을 태그하고 거기서 자식을 만든다.**
systemd-logind 가 만드는 `session-N.scope` 와 성질이 같다 — 둘 다 cgroup
하나이고, 그 안에서 태어난 프로세스가 대상이다.

**S3(PAM 타이밍)이 끝나면 `helpers.bash` 의 그 부분만 진짜 세션으로 갈아끼운다.**
케이스는 손대지 않는다.

## 돌리기

```sh
make check           # clang · BTF · lsm · bats · bpffs
make
sudo make test
```

```sh
sudo ./tagprobe daemon --tag-cgroup <id> &   # 손으로 붙일 때
sudo ./tagprobe query <pid>
sudo ./tagprobe dump
```

`bats` 가 없으면 `sudo apt install bats`.
`/sys/fs/bpf` 가 안 붙어 있으면 `sudo mount -t bpf bpf /sys/fs/bpf`
(헬퍼가 자동으로 시도한다).

맵은 **bpffs 에 pin** 한다. bats 케이스가 데몬과 별도 프로세스라 필요하고,
제품에서도 warrantd 재시작 중 태깅 공백을 막으려고 같은 방식을 쓴다.

## 감사 모드다

`lsm/bprm_check_security` 는 **기록만 하고 언제나 `return 0`** 이다.
자기보호 6종(§16) 전에 `-EPERM` 을 켜면 verifier 를 통과한 버그 하나로
자기 박스에서 잠긴다. `§04 위임-1` 이 skip 인 이유가 이것이다.
