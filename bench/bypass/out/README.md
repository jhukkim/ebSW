# bench/bypass/out/ — S2 실행 기록

`sudo make test` 가 여기에 `<타임스탬프>.txt` 를 남긴다. 커널·lsm·systemd·docker
버전 헤더 뒤에 bats 전체 출력이 붙는다.

**이 디렉터리는 커밋한다.** `bench/overhead/out/` 과 같은 이유다 —
"§04 표가 이 커널에서 참이었다"는 심사 자료이고, 검증 대상 커널(7.0 · Rocky 9)
에서 다시 돌릴 때 지금 결과와 나란히 놓아야 한다.

## 지금 비어 있다

2026-09-03 에 서브 PC(6.8.0-138-generic)에서 **8 통과 · 9 skip · 0 실패** 로
돌았고 그 결과가 `CLAUDE.md` 「S2에서 실측된 것」과 `docs/experiments.md` 에
기록돼 있다. **그런데 출력 파일이 커밋되지 않았다.**

심사에서 "돌려봤다"와 "출력이 리포에 있다"는 다르게 취급된다.
서브 PC에서 재실행해 채울 것:

```sh
cd ~/ebSW/bench/bypass
make check          # BTF · lsm=bpf · bats · bpffs 확인
sudo make test
git add out && git commit -m "S2 실측: $(uname -r)" && git push
```

## 읽을 때

`assert_tag <pid> <cg> <task>` 가 §04 표의 'cgroup' 열과 'fork 체인' 열을
**각각** 확인한다. 한 줄로 뭉치지 않는 이유는 `systemd-run --scope`
(`cg_tag=0 task_tag=1`, 2차 방어선에 걸림)와 `nohup`(`1 1`, 1차에 걸림)이
구분되어야 하기 때문이다. 그 구분이 사라지면 2차 방어선이 실제로 일하고
있는지 증명할 방법이 없다.

skip 은 실패가 아니다. §18 이 인정한 네 구멍과 미구현 방어선 세 개는
**사유를 명시한 skip 으로 커밋돼 있다** — "알고 있으나 막지 못한다"와
"모른다"는 다르다.

## 아직 진짜 세션이 아니다

`helpers.bash` 가 bats 자신의 cgroup 을 태그한다. `session-N.scope` 와 성질은
같지만 실물 세션이 아니다. **S3(PAM 타이밍) 뒤에 `helpers.bash` 만 갈아끼우고
케이스는 손대지 않은 채 재확인한다.** 그때 나온 결과가 최종 근거다.
