#!/usr/bin/env bash
# 대형 리포 git status — stat/open 이 촘촘하고 대부분 읽기다.
set -euo pipefail
R="$(dirname "$0")/../fixtures/tree"
[[ -d $R ]] || { echo "픽스처 없음. ./fixture.sh 를 먼저 돌려라" >&2; exit 1; }
# 한 번은 37ms 라 프로세스 기동 시간이 대부분이다 — 훅 비용이 묻힌다.
# 20회 돌려 측정 바닥에서 떼어놓는다.
for _ in $(seq 20); do
    git -C "$R" --no-optional-locks status --porcelain >/dev/null
done
