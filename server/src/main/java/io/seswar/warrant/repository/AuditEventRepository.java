package io.seswar.warrant.repository;

/**
 * 감사 이벤트.
 *
 * <p>일 단위 range 파티션 + BRIN 인덱스로 시작한다.
 * 처음부터 ClickHouse 를 넣고 싶어지지만, 2~3인 팀에서 저장소를 둘로 나누는 비용은 생각보다 크다.
 * 데모 규모(노드 3~5대, 2주)에서는 PostgreSQL 하나로 충분하다(기술 스택 §07).
 *
 * <p>적재는 JPA 가 아니라 <b>배치 INSERT</b>로 한다.
 * 엔티티 단건 저장으로는 ringbuf 유입량을 못 따라간다.
 */
// @Repository
public interface AuditEventRepository {

    // insertBatch(List<AuditEvent>)            — ON CONFLICT (node_id, node_seq) DO NOTHING
    // search(AuditQuery)                        — 파티션 프루닝이 걸리게 항상 시간 범위를 강제한다
    // countByWarrantId(UUID)
}
