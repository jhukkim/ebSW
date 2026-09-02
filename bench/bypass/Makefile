# S2 — §04 우회 경로 하네스
#
#   make              tagprobe.bpf.o + tagprobe
#   sudo make test    bats 전체 (§04 표 + §18 구멍)
#   make check

BPFDIR  := ../../bpf
CLANG   ?= $(shell command -v clang-19 || command -v clang-18 || command -v clang)
BPFTOOL ?= $(shell command -v bpftool || echo /usr/lib/linux-tools/$(shell uname -r)/bpftool)
ARCH    := $(shell uname -m | sed 's/x86_64/x86/; s/aarch64/arm64/; s/ppc64le/powerpc/')

BPF_CFLAGS  := -g -O2 -Wall -target bpf -D__TARGET_ARCH_$(ARCH) \
               -I$(BPFDIR) -I/usr/include/$(shell uname -m)-linux-gnu
HOST_CFLAGS := -g -O2 -Wall
HOST_LDLIBS := -lbpf -lelf -lz

V ?= 0
ifeq ($(V),1)
  Q :=
else
  Q := @
endif

.PHONY: all clean check test
.SECONDARY:
all: tagprobe tagprobe.bpf.o

$(BPFDIR)/vmlinux.h:
	$(Q)$(MAKE) -C $(BPFDIR) vmlinux.h

tagprobe.bpf.o: tagprobe.bpf.c $(BPFDIR)/vmlinux.h
	@test -n "$(CLANG)" || { echo "ERROR: clang 이 없다. ../../deploy/bootstrap.sh --install"; exit 1; }
	@echo "  BPF   $@"
	$(Q)$(CLANG) $(BPF_CFLAGS) -c $< -o $@

tagprobe: tagprobe.c
	@echo "  CC    $@"
	$(Q)$(CC) $(HOST_CFLAGS) tagprobe.c -o $@ $(HOST_LDLIBS)

# bats 는 root 로 돌아야 한다 — BPF LSM 부착과 su/sudo 케이스 때문이다.
test: all
	@test "$$(id -u)" = 0 || { echo "ERROR: sudo make test"; exit 1; }
	bats *.bats

check:
	@echo "CLANG   = $(CLANG)"
	@echo "BTF     = $(shell test -r /sys/kernel/btf/vmlinux && echo 있음 || echo '없음 ← 문제')"
	@echo "lsm     = $(shell cat /sys/kernel/security/lsm 2>/dev/null || echo '읽을 수 없음')"
	@echo "bats    = $(shell command -v bats || echo '없음 ← sudo apt install bats')"
	@echo "bpffs   = $(shell mount | grep -q 'type bpf' && echo 마운트됨 || echo '없음 ← sudo mount -t bpf bpf /sys/fs/bpf')"

clean:
	rm -f tagprobe.bpf.o tagprobe
