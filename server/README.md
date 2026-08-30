# warrant-server

Session Warrant 의 컨트롤 플레인. 영장 발급 · 승인 · 서명 · push · 취소 · 감사 조회를 담당한다.

**현재 상태: 요구사항 골격.** 모든 클래스가 시그니처와 의사코드 주석만 갖고 있고 본문은 비어 있다.
설계 원본은 `docs/session-warrant-plan.html`(§ 번호) 과 `docs/session-warrant-tech-stack.html` 이다.

## 이 서버가 지는 책임과 지지 않는 책임

| 하는 일 | 하지 않는 일 |
|---|---|
| 영장 발급 · 승인 워크플로 · 서명(Ed25519) | 집행 판정 — 커널이 한다. 판정 시점에 여기로 올라오는 왕복은 없다 |
| 만료 시각 · 취소 플래그를 노드에 push | 만료 감시 타이머 — 훅이 매 판정마다 시각을 직접 비교한다 |
| 정책을 표현 형태로 보관 · lint | 경로 → inode 컴파일 — warrantd가 노드에서 한다 |
| 감사 이벤트 수집 · 조회 · 리포트 | 세션 녹화 · 터미널 입력 수집 |

중앙이 끊겨도 이미 발급된 영장의 만료와 강제는 노드에서 정확히 계속된다(§17).
**이 서버는 느슨하게 실패해야 한다.** 여기가 죽었다고 로그인이 막히면 안 된다.

## 패키지 배치

```
io.seswar.warrant
├── domain/       엔티티 · 값 객체 · 도메인 규칙 (warrant · policy · subject · node · audit)
├── application/  유스케이스 서비스 (발급 · 연장 · 취소 · 승인 · 감사 수집 · 무영장 탐지)
├── crypto/       Ed25519 서명 — protobuf 바이트에 서명한다
├── grpc/         warrantd 와의 통신 (영장 push = 서버 스트리밍, 감사 = 클라이언트 스트리밍)
├── api/          REST — 콘솔 · 리포트
├── slack/        Block Kit 승인 흐름
├── repository/   Spring Data JPA
└── config/       Security(OIDC) · gRPC · 가상 스레드
```

## 의존성에서 한 번 걸리는 지점

Spring Boot 4 는 Boot 3 과 스타터 좌표가 다르고, gRPC 는 아예 소속이 바뀌었다.

| Boot 3 에서 쓰던 것 | Boot 4 에서 | 
|---|---|
| `spring-boot-starter-web` | `spring-boot-starter-webmvc` |
| `spring-boot-starter-oauth2-client` | `spring-boot-starter-security-oauth2-client` |
| `flyway-core` 직접 | `spring-boot-starter-flyway` |
| `org.springframework.grpc:spring-grpc-spring-boot-starter` | `org.springframework.boot:spring-boot-starter-grpc-server` |
| `org.testcontainers:junit-jupiter` | `org.testcontainers:testcontainers-junit-jupiter` |

**spring-grpc 의 자체 스타터는 1.0.3 에서 멈췄다.** 1.1.x 에는 `spring-grpc-core` 만 배포되고
스타터는 Spring Boot 쪽으로 옮겨갔다. 그래서 `spring-grpc-dependencies` BOM 을 import 해도
스타터 버전이 채워지지 않고 `Could not find org.springframework.grpc:spring-grpc-spring-boot-starter:.`
로 실패한다 — 빈 버전이 그 증상이다. Boot BOM 하나에 맡기면 된다
(Boot 4.1.1 이 spring-grpc 1.1.1 · grpc-java 1.83.1 · protobuf-java 4.35.1 을 관리한다).

protobuf-gradle-plugin 은 BOM 을 읽지 못하므로 `ext.protobufVersion` · `ext.grpcVersion` 을
직접 적어 뒀다. **Boot 버전을 올릴 때 이 두 값을 같이 확인할 것** — 어긋나면
생성 코드와 런타임 라이브러리가 다른 버전이 되어 진단하기 어려운 오류가 난다.

## 구현 순서

1. `../proto/warrant.proto` 확정 — 이게 늦어지면 커널 담당과 검증 담당이 서로를 기다린다
2. `Warrant` · `Policy` 엔티티 + Flyway V1
3. 발급 → 서명 → push 경로 (`WarrantIssuanceService` → `WarrantSigner` → `WarrantPushService`)
4. 감사 수집 (`AuditIngestService`) 및 무영장 세션 탐지
5. Slack 승인 · 연장 정책
