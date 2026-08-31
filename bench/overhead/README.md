# bench/overhead/ — S1: `file_open` 오버헤드

§09 가 지목한 선행 검증 셋 중 **가장 위험한 것**이다.
여기서 한 자릿수 %가 안 나오면 쓰기 통제를 `inode_*` 5종만으로 재설계해야 하고,
그러면 그 위에 얹을 예정인 것이 전부 흔들린다.
훅 부착 순서상 `file_open` 은 네 번째지만 **측정은 여기서 먼저** 한다.

## 왜 3단이 아니라 4단인가

S0 에서 쓰기 의도가 전체 `file_open` 의 **4.7%** (123/2,598) 로 나왔다.
그래서 쓰기 게이트가 독립된 측정 층이 된다 — 3단으로 재면
"훅이 비싼가 판정이 비싼가"가 뭉개진다.

| | 훅 내용 | 재는 것 |
|---|---|---|
| A | 훅 없음 | 기준선 |
| B | `return 0` 만 | LSM 훅 부착 자체의 비용 |
| C | `+ f_mode & FMODE_WRITE` 앞문 | 95% 가 여기서 끝난다 |
| D | `+ cgroup 조회 · 맵 2회 · 시간 비교` | 나머지 5% 가 내는 비용 |

**티어는 파일이 아니라 컴파일 타임 상수다** (`gate.bpf.c`, `-DTIER=`).
C 는 B 에 한 줄 더한 것이고 D 는 C 에 조회를 더한 것이라는 관계가
소스에 그대로 보여야 한다. 파일 넷으로 쪼개면 티어끼리 슬금슬금
달라져도 아무도 모른다.

## 매크로와 마이크로를 나눈 이유

**평균이 아니라 p99 를 본다.** 평균 2% 인데 p99 가 30% 면 못 쓴다.
그런데 hyperfine 반복은 수십 회라 거기서 p99 를 뽑는 건 의미가 없다.
그래서 두 종류를 따로 뽑는다.

| | 무엇 | 어떻게 | 빌드 |
|---|---|---|---|
| 매크로 | 워크로드 벽시계, A 대비 % | hyperfine | `PROBE=0` |
| 마이크로 | 훅 1회당 ns 분포, p99 | BPF 안의 log2 히스토그램 | `PROBE=1` |

`PROBE=1` 은 훅마다 `bpf_ktime_get_ns()` 를 두 번 부른다.
그 비용이 티어 B 가 내는 비용과 자릿수가 비슷하다 —
**마이크로 절대값을 매크로 % 로 환산하지 말 것.** 티어 간 차이만 읽는다.

카운터·히스토그램 맵은 전부 `PERCPU` 다. S0 의 `smoke` 는 평범한 `ARRAY` +
`__sync_fetch_and_add` 를 썼는데, 그건 한 캐시라인을 모든 CPU 가 두들기는
구조다. `-P8` 병렬 워크로드에서는 그 경합 자체가 측정값이 되어버린다.

## 돌리기

```sh
make                       # 오브젝트 6개 + 로더
make check                 # 툴체인·lsm·hyperfine 확인
./fixture.sh               # 워크로드 픽스처 (네트워크 안 탄다)
sudo ./run.sh              # 4단 × 4워크로드 → out/<타임스탬프>/report.txt
```

```sh
sudo ./run.sh --runs 20 --workloads w_find,w_build
sudo ./run.sh --with-apt   # 기획서가 지목한 apt 워크로드 (참고용)
```

`hyperfine` 이 없으면 `sudo apt install hyperfine`.
`/sys/kernel/security/lsm` 에 `bpf` 가 없으면
`sudo ../../deploy/enable-bpf-lsm.sh` 후 재부팅.

## 워크로드 — 부하 구간이어야 한다

S0 숫자(유휴 초당 5~15건)는 **유휴 노트북 것**이라 그대로 쓰면 안 된다.

| | 성격 | 노리는 것 |
|---|---|---|
| `w_find` | 읽기 폭주 (`find /usr \| xargs -P8 head -c1`) | B→C 차이. 여기서 안 보이면 앞문 설계가 틀렸다 |
| `w_git` | 대형 리포 `git status` | stat/open 이 촘촘한 읽기 |
| `w_build` | `.o` 400개 컴파일 | C→D 비용이 실제로 나는 곳 |
| `w_untar` | 파일 생성 폭주 | `inode_*` 재설계 시나리오의 기준선 |
| `w_apt` | `apt install --reinstall` | 기획서 지목. **네트워크에 흔들려 기본에서 뺐다** |

`w_apt` 를 뺀 넷은 네트워크를 타지 않는다 — 재현되지 않는 벤치는 벤치가 아니다.

## 태그를 반드시 심는다

`run.sh` 는 자기 cgroup id 를 읽어 `--tag-cgroup` 으로 넘긴다.
안 심으면 티어 D 가 전부 `tag_miss` 로 빠져서 해시 조회 두 번 중
**한 번만 재고는 "D 가 싸다"는 틀린 답**이 나온다.
`report.txt` 의 `tag_hit` / `tag_miss` 를 항상 확인할 것 — `tag_hit` 이 0 이면
그 실행의 D 숫자는 버린다.

## 판정

- **매크로 Δ 가 한 자릿수 %** → 통과. `file_open` 으로 간다.
- 두 자릿수 → 쓰기 통제를 `inode_{create,unlink,rename,link,symlink}` 5종만으로 재설계.

`dev` major 분포도 같이 찍는다. major 0(procfs·sysfs·tmpfs·cgroupfs·pipefs)이
트래픽 대부분이겠지만 **superblock 으로 건너뛰지 않는다** —
`/proc/sys/kernel/*` 쓰기와 `/sys/fs/cgroup` 조작이 정확히 통제 대상이다 (§15).
표를 남기는 건 "왜 안 걸렀나"를 나중에 설명하기 위해서다.

## 결과를 맥북으로 가져가기

측정값은 **커밋한다.** `out/` 은 `.gitignore` 에서 열어놨다 (로더 로그 `*.log` 만 제외).
스파이크 코드는 던져버려도 숫자는 남는다 — 재설계 판단의 근거이고,
훅을 하나씩 붙일 때마다 이 숫자와 비교하게 된다.

서브 PC 에서:

```sh
sudo ./run.sh                      # 끝나면 결과 소유권을 되돌려준다
git add bench/overhead/out && git commit -m "S1 실측: $(uname -r)" && git push
```

맥북에서:

```sh
git pull
cat bench/overhead/out/*/report.txt
```

`report.txt` 하나만 봐도 판정은 된다. JSON 은 나중에 다시 그리거나
다른 커널의 결과와 나란히 놓을 때 쓴다 — **커널 7.0(Ubuntu 26.04)·Rocky 9
검증 때 지금 숫자와 비교해야 하므로 원본을 버리지 않는다.**

한 번만 급하게 볼 거면 `scp` 도 된다. 다만 그렇게 가져온 숫자는
기록에 남지 않으므로, 판정에 쓸 실행은 커밋할 것.

```sh
scp -r <서브PC>:~/SessionWarrant/bench/overhead/out/<타임스탬프> /tmp/
```

## 던져버리는 것과 남기는 것

`gate.bpf.c` · `gate.c` 는 스파이크다. 제품의 `warrantd` 는 cilium/ebpf + bpf2go 로 간다.
**남기는 건 이 하네스 자체다** — 훅을 하나 붙일 때마다 여기서 다시 잰다.
숫자 없이 다음 훅으로 넘어가지 않는다.

반환값은 전 구간 `return 0` 이다. **여기를 `-EPERM` 으로 바꾸지 말 것** —
자기보호 6종(§16) 전에 켜면 verifier 를 통과한 버그 하나로 자기 박스에서 잠긴다.
