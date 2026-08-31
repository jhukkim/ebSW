#!/usr/bin/env bash
# 기획서가 지목한 워크로드지만 네트워크·미러 상태에 흔들린다.
# 기본 세트에서 빠져 있고 --with-apt 로만 돈다. 숫자는 참고용으로만 읽을 것.
set -euo pipefail
PKG=${SW_APT_PKG:-coreutils}
sudo apt-get install -y --reinstall -o Dpkg::Use-Pty=0 "$PKG" >/dev/null
