package io.seswar.warrant.domain.node;

import java.time.Instant;
import java.util.UUID;

/** 영장을 집행하는 호스트. warrantd 한 대가 한 노드다. */
// @Entity @Table(name = "node")
public class Node {

    private UUID id;

    private String hostname;

    private String kernelVersion;

    /**
     * BPF LSM 이 켜져 있는가 ({@code /sys/kernel/security/lsm} 에 bpf 포함).
     * false 면 이 노드에서는 ENFORCE 영장을 발급해도 강제되지 않는다 —
     * <b>발급 시점에 거부하거나 최소한 승인자에게 알려야 한다</b>. 조용히 통과시키면
     * "막고 있다고 믿는데 안 막히는" 최악의 상태가 된다.
     */
    private boolean bpfLsmEnabled;

    /** 마지막 하트비트. gRPC 스트림이 살아 있는지와는 별개로 기록한다. */
    private Instant lastSeenAt;

    /**
     * 노드 부팅 시각. {@code Instant} → {@code bpf_ktime_get_boot_ns} 변환의 기준이지만
     * <b>변환은 warrantd 가 한다</b>. 여기 값은 시계 스큐 진단용 참고 정보일 뿐이다.
     */
    private Instant bootedAt;
}
