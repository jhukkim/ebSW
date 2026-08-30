package io.seswar.warrant.application;

import java.util.UUID;

/**
 * 회수. 연장과 <b>같은 경로</b>라, 진행 중인 세션의 권한을 승인자가 실시간으로 좁힐 수 있다(§03).
 *
 * <p>커널에서는 {@code warrants[id].revoked = 1} 한 바이트다.
 * 맵의 바이트 하나를 뒤집으면 전 노드에서 즉시 발효된다 — 프로세스 순회도, 신호도 없다(§05).
 */
// @Service @Transactional
public class WarrantRevocationService {

    public void revoke(UUID warrantId, UUID actorId, String reason) {
        // 1. warrant.revoke(actorId, reason)  — DB 먼저. push 실패해도 취소 사실은 남아야 한다
        // 2. 대상 노드 전부에 push. 스트림이 끊긴 노드는 재연결 시 전체 동기화로 따라잡는다
        // 3. 노드 하나라도 push 실패하면 그 사실을 경보한다 —
        //    "취소했다고 믿는데 아직 살아 있는" 상태가 가장 위험하다
        throw new UnsupportedOperationException("미구현");
    }

    /**
     * 주체 단위 일괄 회수. 계정 탈취 대응 · 퇴사 처리용.
     */
    public int revokeAllForSubject(UUID subjectId, UUID actorId, String reason) {
        throw new UnsupportedOperationException("미구현");
    }
}
