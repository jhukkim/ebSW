package io.seswar.warrant.grpc;

import java.util.UUID;

/**
 * 노드별 열린 push 스트림 보관.
 *
 * <p>프로세스 로컬 상태다. 서버를 여러 대로 늘리면 노드가 붙은 인스턴스에서만 push 가 되므로,
 * 그때는 브로드캐스트(예: PostgreSQL LISTEN/NOTIFY)를 앞에 둔다.
 * <b>지금 단계에서 그걸 미리 넣지 않는다</b> — 데모 규모는 단일 인스턴스로 충분하다.
 */
// @Component
public class NodeStreamRegistry {

    public void attach(UUID nodeId /*, StreamObserver<WarrantProto> stream */) {
        throw new UnsupportedOperationException("미구현");
    }

    public void detach(UUID nodeId) {
        throw new UnsupportedOperationException("미구현");
    }

    /** @return push 성공 여부. false 면 pending 으로 남기고, 취소 건이면 경보한다 */
    public boolean send(UUID nodeId, byte[] signedWarrant) {
        throw new UnsupportedOperationException("미구현");
    }
}
