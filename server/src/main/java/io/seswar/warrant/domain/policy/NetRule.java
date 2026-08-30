package io.seswar.warrant.domain.policy;

/**
 * 아웃바운드 허용 대역. 커널에서는 {@code (policy_id, CIDR)} 키의 LPM 트라이 엔트리가 된다.
 *
 * <p>읽기 통제를 포기한 대가를 여기서 메운다 — <b>읽을 수는 있어도 밖으로 내보낼 수 없다</b>(§15).
 * 그래서 이 목록을 넓게 여는 것은 읽기 통제 포기와 곱해져서 위험해진다.
 */
// @Embeddable
public record NetRule(String cidr, Integer port) {

    public boolean isWideOpen() {
        // 0.0.0.0/0 · ::/0 처럼 사실상 전면 허용인가.
        // "범위가 전부 허용이면 아무것도 통제하지 않는다"(§06) — lint 경고 대상.
        throw new UnsupportedOperationException("미구현");
    }
}
