#!/usr/bin/env bash
# 대형 리포 git status — stat/open 이 촘촘하고 대부분 읽기다.
set -euo pipefail
R="$(dirname "$0")/../fixtures/tree"
[[ -d $R ]] || { echo "픽스처 없음. ./fixture.sh 를 먼저 돌려라" >&2; exit 1; }
git -C "$R" --no-optional-locks status --porcelain >/dev/null
