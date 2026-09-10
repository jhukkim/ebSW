# S4 — inode 안정성 하네스
#
#   make                 inowatch
#   make check           커널 · fanotify 전제 확인
#   sudo make test       케이스 전체 (랩 디렉터리 + /usr 감시)
#   sudo make test-apt   실제 패키지 재설치 포함 (네트워크 필요)
#
# 랩은 mktemp -d 로 /tmp 아래 만들고 끝나면 지운다. /usr 는 감시만 하고
# 건드리지 않는다 — 실제 교체를 보려면 test-apt 다.

SHELL := /bin/bash
CFLAGS ?= -O2 -Wall -Wextra

.PHONY: all check test test-apt clean

all: inowatch

inowatch: inowatch.c
	@echo "  CC    $@"
	@$(CC) $(CFLAGS) -o $@ $<

check:
	@echo "kernel     = $$(uname -r)"
	@echo "fanotify.h = $$(test -f /usr/include/sys/fanotify.h && echo 있음 || echo '없음 ← libc 헤더 확인')"
	@echo "DFID_NAME  = 커널 5.9+ 필요 (현재 $$(uname -r))"
	@echo "root       = $$(test $$(id -u) = 0 && echo 예 || echo '아니오 ← sudo 필요')"
	@echo "/usr fs    = $$(findmnt -no FSTYPE /usr 2>/dev/null || findmnt -no FSTYPE /)"
	@echo "/tmp fs    = $$(findmnt -no FSTYPE /tmp)"
	@echo
	@echo "  /tmp 가 tmpfs 면 랩 케이스는 tmpfs 위에서 돈다. 실디스크(ext4)와"
	@echo "  inode 동작이 같은지는 별개 문제이므로, 다르면 SW_LAB=/var/tmp 로 옮긴다."

test: all
	@test "$$(id -u)" = 0 || { echo "ERROR: sudo make test"; exit 1; }
	./cases.sh

test-apt: all
	@test "$$(id -u)" = 0 || { echo "ERROR: sudo make test-apt"; exit 1; }
	./cases.sh --with-apt

clean:
	rm -f inowatch
