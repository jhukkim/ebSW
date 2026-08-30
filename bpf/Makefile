# Session Warrant — BPF 빌드
#
#   make            smoke 스파이크 빌드
#   make vmlinux.h  이 커널의 BTF 덤프 (커밋하지 않는다 — 커널마다 다르다)
#   make clean
#
# clang 18+ 필요. 없으면 ../deploy/bootstrap.sh --install

CLANG    ?= $(shell command -v clang-19 || command -v clang-18 || command -v clang)
BPFTOOL  ?= $(shell command -v bpftool || echo /usr/lib/linux-tools/$(shell uname -r)/bpftool)
ARCH     := $(shell uname -m | sed 's/x86_64/x86/; s/aarch64/arm64/; s/ppc64le/powerpc/')
INCLUDES := -I. -I/usr/include/$(shell uname -m)-linux-gnu

.PHONY: all clean check
all: smoke

# ── BTF ─────────────────────────────────────────────────────────────
# CO-RE 의 재료. 이 파일은 커널 버전에 묶여 있으므로 .gitignore 에 있다.
vmlinux.h:
	@echo "  BTF   $@  ($(shell uname -r))"
	@$(BPFTOOL) btf dump file /sys/kernel/btf/vmlinux format c > $@

# ── BPF 오브젝트 ────────────────────────────────────────────────────
%.bpf.o: %.bpf.c vmlinux.h
	@echo "  BPF   $@"
	@$(CLANG) -g -O2 -target bpf -D__TARGET_ARCH_$(ARCH) $(INCLUDES) -c $< -o $@
	@$(BPFTOOL) gen object $@ $@

%.skel.h: %.bpf.o
	@echo "  SKEL  $@"
	@$(BPFTOOL) gen skeleton $< > $@

# ── 로더 ────────────────────────────────────────────────────────────
smoke: smoke.c smoke.skel.h
	@echo "  CC    $@"
	@$(CC) -g -O2 $(INCLUDES) smoke.c -lbpf -lelf -lz -o $@
	@echo "  실행: sudo ./bpf/smoke"

check:
	@echo "CLANG   = $(CLANG)"
	@echo "BPFTOOL = $(BPFTOOL)"
	@echo "ARCH    = $(ARCH)"

clean:
	rm -f *.o *.skel.h smoke
	@echo "vmlinux.h 는 남겨둔다 (재생성이 느리다). 지우려면: rm bpf/vmlinux.h"
