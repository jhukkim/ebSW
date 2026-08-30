package io.seswar.warrant.domain.audit;

import java.time.Instant;
import java.util.UUID;

/**
 * 유실 구간.
 *
 * <p>ringbuf 용량을 넘기거나 warrantd 가 장기 부재하면 이벤트가 유실된다.
 * 그때 <b>"빈 구간"을 숨기지 않고 명시적으로 기록한다</b>(§14).
 *
 * <p>이게 왜 중요한가: 감사 로그에 구멍이 있다는 사실 자체를 감추면,
 * 조사자가 "이 시간대에는 아무 일도 없었다"로 잘못 읽는다.
 * 유실을 인정하는 쪽이 신뢰도가 높다.
 */
// @Entity @Table(name = "audit_gap")
public class EventGap {

    private UUID id;

    private UUID nodeId;

    private Instant from;

    private Instant to;

    /** 커널 ringbuf 가 보고한 드롭 카운트. 알 수 없으면 null. */
    private Long droppedCount;

    /** RINGBUF_OVERFLOW · AGENT_DOWN · CENTRAL_UNREACHABLE 등. */
    private String cause;
}
