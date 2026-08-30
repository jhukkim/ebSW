package io.seswar.warrant.config;

/**
 * spring-grpc 설정.
 *
 * <p>노드 인증은 mTLS 를 기본으로 한다. 영장 스트림에는 정책 전체가 흐르므로
 * 아무나 붙을 수 있으면 <b>정책이 곧 유출</b>이고, 공격자가 "무엇이 막혀 있는지" 지도를 얻는다.
 */
// @Configuration
public class GrpcConfig {

    // - 서버 포트 · TLS 설정
    // - keepalive: 노드가 NAT 뒤에 있어도 스트림이 유지되도록
    // - 최대 메시지 크기: 감사 배치 크기와 맞춘다
}
