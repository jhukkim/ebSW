package io.seswar.warrant.application;

import io.seswar.warrant.domain.warrant.Warrant;

import java.time.Duration;
import java.util.UUID;

/**
 * 연장 — <b>재로그인이 아니다</b>(§03).
 *
 * <p>승인자가 연장을 누르면 중앙이 {@code expires_ns} 를 갱신해 push 하고,
 * 열려 있는 세션이 그대로 이어진다. 돌던 작업은 아무 일 없이 계속된다.
 *
 * <h3>자동화의 경계</h3>
 * 연장이 이렇게 싸기 때문에 "그냥 자동 연장하면 되지 않나"가 바로 다음 질문이 된다.
 * 답은 <b>요청과 승인을 갈라서, 요청만 자동화한다</b>이다.
 * 완전 자동 연장은 "활동이 있는 한 만료되지 않는 영장"이고, 그건 30분 약속을 거짓말로 만든다 —
 * <b>그리고 공격자의 활동도 활동이다.</b>
 */
// @Service @Transactional
public class WarrantExtensionService {

    /**
     * T-5분 자동 요청 생성. warrantd 가 진행 중 작업을 감지해 올려 준다.
     * <b>이 단계는 전자동이어도 안전하다</b> — 요청일 뿐 권한이 늘지 않는다.
     */
    public void requestAutomatically(UUID warrantId, String detectedWorkload) {
        // 1. 이미 열려 있는 연장 요청이 있으면 중복 생성하지 않는다
        // 2. 승인자에게 push (Slack). "무슨 작업이 돌고 있어서" 요청인지 함께 보낸다
        throw new UnsupportedOperationException("미구현");
    }

    /**
     * 사람이 승인하는 연장. 기본 경로다.
     */
    public Warrant extend(UUID warrantId, Duration by, UUID approverId, String reason) {
        // 1. assertWithinCumulativeCap()
        // 2. warrant.extend(by, approverId, reason, autoApproved=false)
        // 3. push — 세션은 끊기지 않는다
        throw new UnsupportedOperationException("미구현");
    }

    /**
     * 정책 자동 승인. <b>명시적 범위에서만</b> 동작한다.
     *
     * <p>예: read-only 영장은 최대 2회, 원 기간의 2배까지. <b>쓰기 영장은 항상 사람.</b>
     * "자동 승인됨"이라는 사실도 근거와 함께 계보에 기록된다.
     */
    public Warrant autoApproveIfEligible(UUID warrantId, Duration by) {
        // 1. 정책에 쓰기 규칙이 하나라도 있으면 자동 승인 불가 — 무조건 사람에게 넘긴다
        // 2. 자동 승인 횟수 · 누적 배수 확인
        // 3. warrant.extend(by, actor=null, autoApproved=true), basis = "read-only 정책 N회차"
        throw new UnsupportedOperationException("미구현");
    }

    /**
     * 누적 상한 — <b>예외 없음</b>.
     *
     * <p>어떤 경로로든(사람 승인이든 자동이든) 상한(예: 원 기간의 3배)을 넘으면
     * 연장이 아니라 재발급이다. 여기에 우회 경로를 만들면 시간 정책 전체가 무의미해진다.
     */
    private void assertWithinCumulativeCap(Warrant warrant, Duration additional) {
        // if (warrant.totalExtendedBy().plus(additional) > warrant.originalDuration() * CAP_MULTIPLIER)
        //     throw new CumulativeCapExceededException(...)  → 호출자가 reissue 경로로 안내
        throw new UnsupportedOperationException("미구현");
    }
}
