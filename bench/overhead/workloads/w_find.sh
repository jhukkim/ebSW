#!/usr/bin/env bash
# 읽기 폭주. file_open 은 100% 불리지만 앞문에서 95% 가 끝나야 한다.
# 티어 B→C 차이가 여기서 안 보이면 앞문 설계가 틀린 것이다.
set -euo pipefail
find /usr -xdev -type f -print0 2>/dev/null | xargs -0 -P8 -n64 head -c1 >/dev/null 2>&1 || true
