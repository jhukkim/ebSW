# deploy/

노드 프로비저닝 · 부트 파라미터 · systemd 유닛.

## 개발 환경

**Vagrant VM 이 아니라 물리 서브 PC 한 대**에서 개발한다.
BPF LSM 은 부팅 파라미터(`lsm=bpf`)와 커널 BTF 에 묶여 있어서, VM 층을 하나 끼우면
"안 되는 게 커널 문제인지 가상화 문제인지"를 매번 의심하게 된다.

| | |
|---|---|
| 배포판 | Ubuntu 24.04.4 LTS |
| 커널 | 6.8.0 — 기획서 §02 의 개발 기준과 일치 |
| 편집 | macOS (이 리포) |
| 빌드·실행·측정 | 서브 PC |
| 동기화 | GitHub |

3노드 구성(중앙 + 노드 2대)은 **중앙 서버가 붙는 시점**에 다시 꺼낸다.
스파이크(S0~S4) 는 전부 한 대에서 끝난다.

## 스크립트

```sh
./deploy/bootstrap.sh              # 커널·설정·툴체인 확인만. 표로 찍는다
./deploy/bootstrap.sh --install    # 확인 + 부족한 것 설치
sudo ./deploy/enable-bpf-lsm.sh    # lsm= 에 bpf 추가. 재부팅 필요
```

`bootstrap.sh` 는 22.04 / 24.04 양쪽에서 돈다. 22.04 면 clang 18 을 apt.llvm.org 에서 가져온다.

## `lsm=bpf` — 가장 먼저 확인할 것

```sh
cat /sys/kernel/security/lsm   # 출력에 bpf 가 없으면 강제 모드는 한 줄도 못 짠다
```

`enable-bpf-lsm.sh` 는 **지금 떠 있는 목록을 읽어 거기에 `,bpf` 만 덧붙인다.**
`lsm=bpf` 만 단독으로 넣으면 AppArmor 가 빠지면서 부팅이 깨질 수 있다 — 커널이 스스로
알려준 목록이 가장 안전한 원본이다. 원본 `grub` 은 타임스탬프를 붙여 백업한다.

부팅이 깨지면 GRUB 메뉴에서 `e` 를 눌러 `lsm=...` 을 지우고 부팅한 뒤 백업을 되돌린다.

## 앞으로 들어올 것

```
systemd/     warrantd.service — Before=sshd.service 는 필수다.
             없으면 부팅 직후 세션이 태그 없이 시작된다
ansible/     노드가 여러 대가 되는 시점에. 지금은 이르다
```

## 규칙

- `/etc/pam.d/sshd` 를 건드리는 작업은 **물리 콘솔 접근이 가능한 상태에서만** 한다.
  ssh 로만 붙어 있는 노드에서 PAM 을 깨면 복구 경로가 없다. 서브 PC 로 개발하는 이유이기도 하다.
- 스파이크 전 구간은 **감사 모드**다. LSM 훅은 `return 0` 만 한다.
  자기보호 6종(§16)을 붙이기 전에 `-EPERM` 을 켜면 자기 발을 쏜다.
- 검증 대상 커널: 6.8(개발) · 7.0(Ubuntu 26.04) · Rocky 9 호환.
