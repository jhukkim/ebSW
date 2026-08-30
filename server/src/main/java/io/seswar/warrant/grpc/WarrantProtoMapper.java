package io.seswar.warrant.grpc;

import io.seswar.warrant.domain.warrant.Warrant;

/**
 * 도메인 ↔ protobuf 변환.
 *
 * <p>커널 구조체와 서버 엔티티가 어긋나면 그 순간부터 디버깅이 지옥이 된다(기술 스택 §06).
 * {@code struct warrant} 의 필드를 그대로 protobuf 메시지로 옮기고,
 * 서버 엔티티와 BPF 맵 값이 <b>같은 .proto 에서 생성되게</b> 한다.
 * 이것이 {@code proto/warrant.proto} 를 가장 먼저 확정하라는 이유다.
 *
 * <h3>여기서 하지 않는 변환</h3>
 * {@code Instant expiresAt} → {@code u64 expires_ns} 변환은 <b>하지 않는다</b>.
 * 커널의 {@code expires_ns} 는 {@code bpf_ktime_get_boot_ns()} 기준, 즉 노드마다 다른
 * 부팅 상대 시각이다. 중앙은 원격 노드의 부팅 시각을 알 수 없으므로
 * wire 에는 <b>절대 시각</b>을 싣고 변환은 warrantd 가 한다.
 */
// @Component
public class WarrantProtoMapper {

    /** @return 서명 대상이 될 직렬화 바이트 */
    public byte[] toSignedBytes(Warrant warrant) {
        // WarrantProto.newBuilder()
        //     .setWarrantId(...)      // display id 와 내부 UUID 를 둘 다 싣는다
        //     .setSubjectId(...)      // u32 — Subject.kernelSubjectId
        //     .setPolicyId(...)       // u32
        //     .setExpiresAtEpochMillis(...)   // 절대 시각. ns 변환은 노드에서
        //     .setGraceUntilEpochMillis(...)
        //     .setRevoked(...)
        //     .setMode(mode.wireValue())
        //     .setOnExpiry(onExpiry.wireValue())
        //     .addAllExecRules(...) .addAllWriteRules(...) .addAllNetRules(...)
        //     .build().toByteArray()
        throw new UnsupportedOperationException("미구현");
    }
}
