package io.seswar.warrant.grpc;

/**
 * warrantd → 중앙. <b>클라이언트 스트리밍</b>.
 *
 * <p>백프레셔가 스트리밍에 이미 있으므로 메시지 큐를 넣지 않는다.
 * 중앙이 잠깐 죽어도 warrantd 의 bbolt 로컬 버퍼가 받아 준다.
 */
// @Service  // extends AuditIngestServiceGrpc.AuditIngestServiceImplBase
public class AuditIngestGrpcService {

    // public StreamObserver<AuditEventProto> stream(StreamObserver<Ack> ack)
    public void stream() {
        // 1. 배치가 찰 때마다 AuditIngestService.ingest()
        // 2. ack 에 마지막으로 적재한 node_seq 를 실어 보낸다 — warrantd 가 여기까지 지운다
        // 3. GapReport 메시지가 오면 AuditIngestService.recordGap()
        //    유실을 조용히 삼키지 않는 지점이 여기다
        throw new UnsupportedOperationException("미구현");
    }
}
