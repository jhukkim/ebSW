package io.seswar.warrant.application;

import io.seswar.warrant.domain.warrant.Warrant;

import java.util.UUID;

/**
 * 영장을 노드로 내려보낸다. 발급 · 연장 · 취소가 전부 이 경로를 쓴다.
 *
 * <p>REST 폴링으로 하면 "즉시 발효"라는 제품 주장이 약해진다 —
 * 서버 스트리밍이라야 취소가 실제로 즉시가 된다(기술 스택 §06).
 *
 * <h3>push 가 실패해도 되는 이유</h3>
 * 이미 내려간 영장의 만료와 강제는 노드에서 독립적으로 계속된다(§17).
 * 그래서 push 실패는 <b>새 정보가 늦게 도착하는</b> 문제일 뿐, 집행이 멈추는 문제가 아니다.
 * 단 하나 예외가 취소다 — 취소 push 실패는 권한이 살아 있다는 뜻이므로 반드시 경보한다.
 */
// @Service
public class WarrantPushService {

    public void push(Warrant warrant) {
        // 1. warrant.targetHosts 로 대상 노드 해석
        // 2. 노드별 열린 스트림에 서명된 protobuf 바이트를 그대로 전달 —
        //    여기서 다시 직렬화하면 서명이 깨진다. 서명한 바이트를 보관했다가 그대로 보낸다
        // 3. 스트림이 없는 노드는 pending 으로 남기고 재연결 시 처리
        throw new UnsupportedOperationException("미구현");
    }

    /**
     * 노드 재연결 시 전체 동기화.
     * 중앙 단절 중에 만료 · 취소된 영장이 있을 수 있으므로 <b>현재 활성 집합 전체</b>를 내려준다.
     */
    public void resync(UUID nodeId) {
        throw new UnsupportedOperationException("미구현");
    }
}
