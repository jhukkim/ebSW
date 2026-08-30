package io.seswar.warrant.domain.audit;

/** 커널 훅의 판정 결과. */
public enum Verdict {

    ALLOW,

    /** 실제로 -EPERM 을 돌려준 경우. */
    DENY,

    /**
     * DRYRUN 이라 막지 않고 기록만 한 경우.
     * 강제로 켰다면 막혔을 건이므로, 최소 권한 초안 검증의 핵심 데이터다(§07 STEP 3).
     */
    WOULD_DENY
}
