package io.seswar.warrant.domain.audit;

import java.time.Instant;
import java.util.UUID;

/**
 * 감사 레코드 한 건. 커널 ringbuf → warrantd → gRPC 클라이언트 스트리밍으로 여기 도착한다.
 *
 * <p>테이블은 일 단위 range 파티션 + BRIN 인덱스로 시작한다.
 * 데모 규모(노드 3~5대, 2주)에서는 PostgreSQL 하나로 충분하고,
 * 2~3인 팀에서 저장소를 둘로 나누는 비용이 더 크다(기술 스택 §07).
 *
 * <h3>무엇이 남고 무엇이 안 남는가(§14)</h3>
 * <ul>
 *   <li>남는다 — 실행된 모든 프로세스, 자원에 손댄 순간</li>
 *   <li>안 남는다 — 셸 빌트인({@code cd}), 인터프리터 내부 로직, 파일 읽기, 터미널 입력</li>
 * </ul>
 * "모든 명령을 기록합니다"는 <b>쓰면 안 되는 문장</b>이다. 고객이 {@code cd} 한 번만 쳐 봐도 반증된다.
 * 정확한 문구는 "실행된 모든 프로세스를 사람에게 귀속시켜 기록합니다".
 */
// @Entity @Table(name = "audit_event")  // PARTITION BY RANGE (occurred_at)
public class AuditEvent {

    private UUID id;

    private Instant occurredAt;

    private UUID nodeId;

    /** null 이면 영장 없는 프로세스. 그 자체가 조사 대상이다. */
    private UUID warrantId;

    /** 커널이 들고 있던 u32. 조회 시점에 사람 이름으로 조인된다. */
    private Integer kernelSubjectId;

    private AuditEventType type;

    private Verdict verdict;

    private long pid;

    private long cgroupId;

    /** sudo 뒤의 uid. 신원이 아니라 정황 정보다 — 신원은 warrantId 쪽에 있다. */
    private int uid;

    /**
     * 실제로 커널이 연 바이너리의 {@code (dev, ino)}.
     * <b>신뢰의 근거는 이것이다.</b> 경로 문자열이 아니다.
     */
    private long deviceId;

    private long inode;

    /** 해석된 경로. 리포트 가독성을 위한 참고 정보이며 증거로 쓰지 않는다. */
    private String resolvedPath;

    /**
     * 명령줄 인자. <b>1급 증거가 아니다</b>(§14).
     * BPF 스택 제약으로 길이가 잘리고, 무엇보다 argv 는 호출자가 통제한다 —
     * {@code exec -a} 한 줄이면 argv[0] 이 통째로 위조된다.
     * 감사 리포트는 inode 기준 실제 실행 파일을 앞세우고 argv 는 뒤에 참고로 붙여야 한다.
     */
    private String argvTruncated;

    /** CONNECT · UDP_SEND 일 때의 목적지. AF_UNIX 면 sun_path. */
    private String destination;
}
