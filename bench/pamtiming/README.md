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

`make collect` 는 `out/<타임스탬프>/` 로 복사한 뒤 `/run` 로그를 비운다.
**디렉터리 하나 = 측정 한 번**이다. (초기에는 안 비워서 나중 디렉터리에 이전
줄이 그대로 또 들어갔다 — `out/20260908-114104` 가 그 흔적이다.)

> **먼저 알아야 할 것 — 아무 데서나 잴 수 없다.**
>
> `pam_systemd.so` 는 **호출한 프로세스가 이미 사용자 세션 안에 있으면 세션 생성을
> 건너뛴다.** 데스크톱 터미널에서 `pamtester` 나 `su` 를 돌리면 그 프로세스는
> `user@1000.service` 아래라 logind 가 아무것도 안 만든다 — `XDG_SESSION_ID` 가
> 안 붙고 **잴 대상 자체가 없다.**
>
> 2026-09-08 측정이 이걸로 8건 전부 `xdg_session_id=-` 가 나왔다. 스택 위치는
> 맞았는데 세션이 없었다. **`pam_systemd.so` 가 스택에 있는 것과 그게 실제로
> 세션을 만드는 것은 다르다.**
>
> 진짜 새 세션은 **밖에서 들어와야** 만들어진다 — SSH 접속, TTY 로그인,
> 데스크톱 로그인 화면. 그래서 1·2단계는 **안전 확인용**이고 판정은
> 1.5단계나 3단계에서 나온다.

### 1단계 — `pamtester`. sshd 를 건드리지 않는다 (위험 0)

```sh
sudo make test
```

전용 서비스 파일 `/etc/pam.d/warrant-probe` 로만 돈다. **모듈이 죽지 않고 로그가
찍히는 걸 확인하는 자리다** — 판정은 여기서 안 나온다(위 상자). 죽으면 `.so` 를
고치면 그만이고 아무것도 잠기지 않는다.

### 1.5단계 — 세션 밖에서 `pamtester`. 여기서 답이 나올 수도 있다 (위험 0)

```sh
sudo make test-detached
```

`systemd-run --scope --slice=system.slice` 로 사용자 세션을 빠져나간 뒤 `pamtester`
를 돌린다. "이미 세션 안"이 아니게 되므로 logind 가 세션을 만들 여지가 생긴다.
**되면 sshd 를 건드리지 않고 §11 T1 의 답이 나온다.**

`make test-detached` 가 `xdg_session_id` 를 보고 성공/실패를 직접 찍는다.
실패하면 logind 가 TTY 없는 호출에 세션을 안 준다는 뜻이고, 3단계로 간다.

### 2단계 — `/etc/pam.d/su` (위험 낮음. 판정은 못 한다)

```sh
sudo make enable-su
su - $USER -c true
sudo make collect
```

**기존 세션 안에서 `su` 를 하면 새 세션이 만들어지지 않는다.** 그래서 이 단계로는
§11 T1 을 잴 수 없다 — **모듈이 `su` 경로에서도 안 죽는다는 것만** 확인하는
자리다. 1.5단계가 통과했다면 건너뛰어도 된다.

(부수 확인: 세션이 안 갈리므로 cgroup 이 그대로고 태그가 유지된다. §04 가 원하는
동작이고, S2 의 `su` → `cg_tag=1` 과 같은 사실을 PAM 층에서 본 것이다.)

`su` 가 깨져도 SSH 는 멀쩡하다. 되돌리기는 `sudo make disable`.

### 3단계 — `/etc/pam.d/sshd`. 여기서만 잠긴다

**"잠긴다"는 기계가 멈춘다는 뜻이 아니다.** 건드리는 건 `/etc/pam.d/sshd`
하나뿐이라 **새 SSH 접속만** 막힌다 — 열려 있는 세션도, 돌던 서비스도, 콘솔
로그인(`/etc/pam.d/login`)도, `sudo`(`/etc/pam.d/sudo`)도 멀쩡하다. 위험한 건
복구 경로가 하나 줄어든다는 것이지 기계가 죽는 게 아니다.

**시작 전 확인:**

1. **콘솔 접근** — 서브 PC 앞에 직접 앉아 로컬 터미널로 작업 중이면 **이미
   충족이다.** 지금 쓰는 그 터미널이 콘솔이다. 맥북에서 SSH 로 붙어 작업
   중이라면 그 연결이 유일한 통로이므로 모니터·키보드를 먼저 확보한다.
2. **`ssh localhost true` 가 원래 되는지 먼저 확인** — 안 되면 나중에 실패했을 때
   모듈 탓인지 원래 안 되던 건지 구분이 안 된다. 처음이면
   `ssh -o StrictHostKeyChecking=accept-new localhost true`.
3. 1단계가 통과했다 (모듈이 안 죽는다)

```sh
ssh localhost true && echo "기준선 정상"     # ← 건드리기 전에 먼저

sudo I_HAVE_CONSOLE=1 make enable-sshd
ssh localhost true && echo "로그인 정상"     # ← 바로 이걸 확인
for i in $(seq 10); do ssh localhost true; done   # 간헐성을 보려면 여러 번

sudo make collect
sudo make disable           # 측정이 끝나면 즉시 되돌린다
```

**`ssh localhost` 도 진짜 SSH 로그인이다.** sshd → PAM 스택 → `pam_systemd.so` →
`session-N.scope` 경로가 원격 접속과 완전히 같다. 다른 건 `rhost` 뿐이고 그건
측정 대상이 아니다. 그리고 **깨진 걸 알아차리는 창구와 고치는 창구가 같은 자리에
있어서** 원격에서 하는 것보다 훨씬 안전하다.

**여러 번 돌릴 것.** `report.py` 가 "일부만 `present_t0=yes`" 를 「가장 나쁜
결과」로 찍는데, 한 번만 들어가면 그 간헐성이 안 보인다.

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
| `⊘ 판정 불가 — 새 세션이 만들어지지 않았다` | 호출자가 이미 사용자 세션 안이었다. **삽입 위치 문제가 아니다** — 1.5단계나 3단계로 간다 |
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
