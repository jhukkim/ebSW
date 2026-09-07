# bench/pamtiming/ — S3: PAM 타이밍

기획서 §09가 지목한 선행 검증 셋 중 **마지막 남은 하나**다(S1 오버헤드 ✅ · S4 inode 미착수).

## 재는 것 — 가정 하나

§11 T1:

> `pam_warrant.so` 가 sshd의 PAM 스택에서 실행된다. account 단계에서 유효한 영장
> 유무를 확인하고, **session 단계에서 `XDG_SESSION_ID` 로 확정된 `session-N.scope`
> 의 cgroup id를 읽어** `cgroup_warrant[cgroup_id] = warrant_id` 를 쓴다.
> PAM 스택에서 `pam_systemd.so` **보다 뒤에 놓여야 한다 — 그 전에는 scope가 아직 없다.**

**"뒤에 놓으면 있다"가 가정이다.** 이 하네스는 그걸 잰다. 아무것도 막지 않고,
아무것도 바꾸지 않고, 한 줄 기록하고 `PAM_SUCCESS` 로 끝난다.

| 통과하면 | 실패하면 |
|---|---|
| `pam_warrant.so` 가 `XDG_SESSION_ID` → 경로 → `stat` 만으로 cgroup id 를 얻는다. 20줄이면 된다 | warrantd 가 **cgroup 트리를 순회**하거나 logind 의 D-Bus `SessionNew` 를 구독해야 한다. `pam/` 와 `agent/internal/pamsock` 설계가 통째로 바뀐다 |

**실패하면 태깅 공백이 생긴다.** scope 가 확정되기 전에 태어난 프로세스는 태그가
없다. 그 구간이 몇 ms 인지도 같이 재야 제품이 그 공백을 어떻게 다룰지 정할 수 있다.

**S3이 S4보다 먼저인 이유:** S3 결과는 아키텍처를 바꾸고, S4 결과는 정책 컴파일러의
재컴파일 트리거 목록만 바꾼다. 늦게 알아서 손해가 큰 쪽을 먼저 한다.

## 무엇을 기록하나

`open_session`·`close_session`·`acct_mgmt` 마다 `/run/warrant-pamprobe.log` 에 한 줄:

```
ts=… boot_us=… phase=open_session service=sshd user=… uid=1000 rhost=…
xdg_session_id=7
proc_cgroup=/user.slice/user-1000.slice/session-7.scope  proc_cgid=12001
scope=/user.slice/user-1000.slice/session-7.scope        scope_cgid=12001
present_t0=yes  waited_us=0  match=yes
```

**경로를 두 가지 방법으로 구해 나란히 적는다.** 한쪽만 보면 모른다.

| | 무엇 | 왜 |
|---|---|---|
| `proc_cgroup` | `/proc/self/cgroup` — sshd 자신이 이미 scope 안에 있는가 | logind 가 `CreateSession` 때 호출자를 scope 로 옮긴다. 옮겨졌으면 이관이 끝난 것 |
| `scope` | `XDG_SESSION_ID` 로 조립한 경로 | **제품이 실제로 쓸 방법** (§11 T1) |
| `match` | 둘이 같은가 | 어긋나면 그 사실 자체가 결과다 — 제품은 `/proc/self/cgroup` 이 아니라 `XDG_SESSION_ID` 를 써야 한다는 근거가 된다 |

`present_t0` 이 핵심 답이고, `no` 면 상한(`wait_ms=200`)까지 폴링해서
`waited_us` 에 **태깅 공백**을 남긴다.

cgroup id 는 cgroup 디렉터리의 inode 번호다 — `bpf_get_current_cgroup_id()` 가
돌려주는 `kn->id` 와 같은 값이고, `bench/bypass/helpers.bash` 도 같은 방법을 쓴다.

## 실행 — 3단계. 건너뛰지 말 것

**이 실험은 지금까지 중 유일하게 기계를 잠글 수 있다.** `/etc/pam.d/sshd` 가
망가지면 SSH 로 다시 못 들어온다. 그래서 위험이 없는 것부터 올라간다.

```sh
make check                  # libpam-dev · pamtester · logind · cgroup v2
sudo make install
```

### 1단계 — `pamtester`. sshd 를 건드리지 않는다 (위험 0)

```sh
sudo make test
```

전용 서비스 파일 `/etc/pam.d/warrant-probe` 로만 돈다. **여기서 모듈이 죽지 않고
로그가 찍히는 걸 확인한 뒤에** 다음으로 간다. 죽으면 `.so` 를 고치면 그만이고
아무것도 잠기지 않는다.

### 2단계 — `/etc/pam.d/su`. 실패해도 SSH 로 들어올 수 있다 (위험 낮음)

```sh
sudo make enable-su
su - $USER -c true          # 진짜 logind 세션이 만들어진다
sudo make collect
```

`su` 도 `common-session` 을 거치므로 `pam_systemd.so` 가 돌고 진짜
`session-N.scope` 가 생긴다. **1단계에서 못 보는 것(실제 logind 세션)을 여기서
보고, 3단계에서만 볼 수 있는 것(sshd 스택의 실제 순서)만 남긴다.**

`su` 가 깨져도 SSH 는 멀쩡하다. 되돌리기는 `sudo make disable`.

### 3단계 — `/etc/pam.d/sshd`. 여기서만 잠긴다

**시작 전에 셋 다 확인:**

1. **물리 콘솔에 접근할 수 있다** (모니터·키보드, 또는 IPMI/iDRAC)
2. **root 셸을 하나 열어 두고 그 창을 닫지 않는다** — 잘못돼도 여기서 되돌린다
3. 2단계가 통과했다

```sh
# root 셸을 하나 열어 둔 채로:
sudo I_HAVE_CONSOLE=1 make enable-sshd

# 다른 터미널에서 새 SSH 접속 — 들어와지는지부터 본다
ssh localhost true && echo "로그인 정상"

sudo make collect
sudo make disable           # 측정이 끝나면 즉시 되돌린다
```

`I_HAVE_CONSOLE=1` 없이는 `enable-sshd` 가 거부한다. 실수로 치는 걸 막기 위한 것이다.

**삽입 위치는 `@include common-session` 또는 `pam_systemd.so` 줄 바로 뒤다.**
그보다 앞이면 scope 가 아직 없어서 측정이 무의미하다 — 있는지 없는지가 아니라
"제대로 놓았는데도 없는지"를 재는 실험이다.

원본은 `/etc/pam.d/sshd.warrant-bak` 로 백업되고 `make disable` 이 복원한다.

## 되돌리기

```sh
sudo make disable     # 백업 복원 + 삽입 줄 제거 + 테스트 서비스 파일 삭제
```

콘솔에서 손으로 해야 하는 상황이면:

```sh
mv /etc/pam.d/sshd.warrant-bak /etc/pam.d/sshd
# 백업이 없으면 warrant-pamprobe 주석 줄과 그 다음 한 줄을 지운다
systemctl restart ssh     # PAM 은 매 로그인마다 다시 읽으므로 보통 불필요
```

## 판정

```sh
python3 report.py out/<타임스탬프>
```

| 결과 | 뜻 |
|---|---|
| `✓ S3 통과` | `present_t0` 전건 `yes`. 설계 그대로 간다 |
| `✗ 실패 — N ms 뒤에 나타난다` | 태깅 공백. `pam/` · `agent/` 설계 변경 |
| `⚠ 불안정` | 일부만 `yes`. **가장 나쁜 결과다** — 재현되지 않는 공백은 사후에 언제 태그가 빠졌는지 알 수 없다 |
| `✗ XDG_SESSION_ID 가 비었다` | 삽입 위치가 `pam_systemd.so` 보다 앞이다. 위치를 내리고 다시 |

`match` 열도 같이 본다. `present_t0=yes` 인데 `match=no` 면 **sshd 프로세스 자신은
아직 이관 전**이라는 뜻이고, 제품이 `/proc/self/cgroup` 을 읽으면 틀린 cgroup 을
태그하게 된다. 그 경우 §11 T1 대로 `XDG_SESSION_ID` 경로만 써야 한다.

## 이 코드는 던져버린다

스파이크다. 남는 건 `out/` 의 측정값과 여기서 확인된 "언제 무엇을 읽을 수 있는가"
뿐이다. 제품 모듈은 `pam/pam_warrant.so` 로 따로 짠다 — 그쪽은 warrantd 에 유닉스
소켓으로 넘기는 일까지 하고, **fail-open** 이어야 한다(§17: PAM 이 warrantd 에 못
붙으면 로그인을 허용하고 무영장 세션으로 기록·경보한다).

이 프로브도 같은 규칙을 지킨다. **모든 경로가 `PAM_SUCCESS` 로 끝나고, malloc 을
쓰지 않고, 폴링에 상한이 있다.** 측정 도구가 로그인을 막으면 그건 측정이 아니다.

## S2 와의 연결

S2 는 bats 자신의 cgroup 을 태그해 세션을 흉내 냈다. **S3 이 끝나면
`bench/bypass/helpers.bash` 만 진짜 `session-N.scope` 로 갈아끼우고 케이스는
손대지 않은 채 §04 표를 재확인한다.** 그게 최종 근거다.
