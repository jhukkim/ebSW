# proto/

**단일 진실 원본.** `struct warrant`(커널) · `Warrant`(서버 엔티티) · BPF 맵 값이 모두 여기서 나온다.
여기가 흔들리면 커널 구조체와 서버 엔티티가 어긋나고, 그때부터 디버깅이 지옥이 된다.

## 들어갈 것

| 파일 | 내용 |
|---|---|
| `warrant.proto` | `Warrant` 메시지 · `Mode` · `OnExpiry` · `State` enum · 정책(exec/write/net 규칙) |
| `agent.proto` | warrantd ↔ 중앙 gRPC 서비스 (발급 push · 취소 · 감사 업로드 · heartbeat) |
| `audit.proto` | ringbuf 레코드 → 중앙 감사 이벤트 |

## 규칙

- **서명은 protobuf 직렬화 바이트에 한다.** JSON 서명은 키 순서·공백 정규화 문제를 만든다.
  서명한 바이트를 그대로 저장하고 그대로 전송한다 — 재직렬화하면 서명이 깨진다.
- 시간 필드는 두 좌표계가 섞인다. 중앙은 **절대시각**(`expires_at`, Unix ns)을 보내고,
  커널의 `expires_ns` 는 **노드별 boot 기준**이다. 변환은 warrantd 가 한다 — proto 에 boot 기준 값을 넣지 말 것.
- 필드 번호는 재사용하지 않는다. 지운 번호는 `reserved` 로 박제한다.
- 커널 구조체에 그대로 매핑되는 메시지는 **고정폭 정수만** 쓴다(`fixed64`/`uint32`).
  varint 는 BPF 쪽에서 파싱할 수 없다.

## 생성물

- Java: `server/build.gradle` 의 `sourceSets.main.proto` 가 이 디렉터리를 참조한다 (protobuf-gradle-plugin).
- Go: `agent/` 에서 `protoc-gen-go` · `protoc-gen-go-grpc`.
- C: BPF 쪽은 protobuf 를 쓰지 않는다. `bpf/warrant.bpf.h` 의 `struct warrant` 를 **손으로** 맞추고,
  일치 여부는 테스트로 지킨다(필드 오프셋 assert).
