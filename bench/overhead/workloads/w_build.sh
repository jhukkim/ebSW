#!/usr/bin/env bash
# 쓰기 무거운 구간. .o 를 400개 만든다 — 여기가 티어 C→D 비용이 실제로 나는 곳이다.
set -euo pipefail
S="$(dirname "$0")/../fixtures/src"
[[ -d $S ]] || { echo "픽스처 없음. ./fixture.sh 를 먼저 돌려라" >&2; exit 1; }
O=$(mktemp -d)
trap 'rm -rf "$O"' EXIT
ls "$S"/*.c | xargs -P8 -n16 -I{} true   # xargs 준비 비용 워밍
find "$S" -name '*.c' -print0 | xargs -0 -P8 -n8 sh -c \
    'for f; do cc -O0 -c "$f" -o "'"$O"'/$(basename "$f" .c).o"; done' _
