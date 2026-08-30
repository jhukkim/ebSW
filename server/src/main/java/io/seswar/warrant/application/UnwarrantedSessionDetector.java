package io.seswar.warrant.application;

import java.time.Instant;
import java.util.UUID;

/**
 * 영장 없는 접속 탐지 — 도입 사다리 STEP 2(§07).
 *
 * <p>게이트웨이를 우회한 접속을 <b>호스트에서</b> 잡아낸다.
 * 모든 트래픽이 게이트웨이를 지난다는 전제는 직접 등록된 authorized_keys 하나,
 * 벤더 관리 장비 하나, 비상 접속 경로 하나면 깨진다(§01).
 */
// @Service
public class UnwarrantedSessionDetector {

    /**
     * warrantd 가 보고한 무영장 세션 등록.
     *
     * <p>주의: 무영장이라고 <b>차단하지 않는다</b>. 감사 모드에서는 기록만 하고,
     * 강제 모드에서도 PAM 이 warrantd 에 못 붙은 경우는 통과시킨다(§17 fail-open).
     * 여기서 fail-close 를 택하면 장애 때 아무도 못 들어간다.
     */
    public void record(UUID nodeId, String loginAccount, String sourceAddress,
                       long cgroupId, String reason, Instant observedAt) {
        throw new UnsupportedOperationException("미구현");
    }

    /**
     * 리포트 한 장 — <b>보통 이게 구매 결정을 만든다</b>.
     *
     * <p>답해야 할 질문: "지금 우리 회사에 영장 없는 SSH 세션이 하루 몇 건이나 있나?"
     * 그 숫자가 0 이 아닌 조직에게는 그 이상 설명이 필요 없고, 0 인 조직은 애초에 고객이 아니다.
     * 대시보드는 Grafana 로 붙이므로 여기서는 집계 쿼리만 제공한다.
     */
    public Object summarize(Instant from, Instant to) {
        // 노드별 · 계정별 · 출처별 건수와, 그 세션들이 실제로 무엇을 했는지(연결 이벤트 수)를 함께 낸다.
        // "몇 건 있었다"보다 "무엇을 했다"가 훨씬 강한 자료다.
        throw new UnsupportedOperationException("미구현");
    }
}
