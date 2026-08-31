#!/usr/bin/env bash
# 쓰기 폭주 — 파일 생성이 주다. inode_create 5종 재설계 시나리오의 기준선이기도 하다.
set -euo pipefail
T="$(dirname "$0")/../fixtures/tree.tar"
[[ -f $T ]] || { echo "픽스처 없음. ./fixture.sh 를 먼저 돌려라" >&2; exit 1; }
O=$(mktemp -d)
trap 'rm -rf "$O"' EXIT
tar xf "$T" -C "$O"
