package io.seswar.warrant.application;

import io.seswar.warrant.domain.warrant.OnExpiry;
import io.seswar.warrant.domain.warrant.WarrantMode;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * 영장 발급 요청.
 *
 * <p>시간 정책의 핵심은 넉넉히 주는 게 아니라 <b>짧게 주고 연장을 싸게 만드는 것</b>이다(§03).
 * 넉넉한 영장은 상시 권한의 재발명이다. 그래서 {@code duration} 의 기본값을 크게 잡지 말 것.
 */
public record IssueWarrantCommand(
        UUID subjectId,
        String reason,
        List<String> targetHosts,
        UUID policyId,
        Duration duration,
        WarrantMode mode,
        OnExpiry onExpiry,
        Duration graceWindow) {
}
