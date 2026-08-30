package io.seswar.warrant.domain.audit;

import java.time.Instant;
import java.util.UUID;

/**
 * 영장 없이 성립한 SSH 세션.
 *
 * <p><b>이 한 장의 리포트가 보통 구매 결정을 만든다</b>(§07 STEP 2).
 * 게이트웨이를 우회한 접속을 호스트에서 잡아내면
 * "우리 회사 SSH 는 전부 통제되고 있다"는 믿음이 사실인지 처음으로 측정된다.
 *
 * <p>검증 질문 하나: <i>"지금 우리 회사에 영장 없는 SSH 세션이 하루 몇 건이나 있나?"</i>
 * 감사 모드 2주면 답이 나온다. 제품 검증과 영업 자료가 같은 데이터에서 나온다.
 */
// @Entity @Table(name = "unwarranted_session")
public class UnwarrantedSession {

    private UUID id;

    private UUID nodeId;

    private Instant observedAt;

    private String loginAccount;

    private String sourceAddress;

    private long cgroupId;

    /** PAM_TIMEOUT · NO_WARRANT · CENTRAL_UNREACHABLE · CACHE_EXPIRED 등. */
    private String reason;

    /**
     * 이 세션이 실제로 무엇을 했는지 — 연결된 감사 이벤트 수.
     * "무영장 세션이 몇 건 있었다"보다 "무영장 세션이 무엇을 했다"가 훨씬 강한 자료다.
     */
    private long observedEventCount;
}
