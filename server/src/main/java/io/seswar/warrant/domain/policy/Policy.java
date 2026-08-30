package io.seswar.warrant.domain.policy;

import java.util.List;
import java.util.UUID;

/**
 * 영장이 허용하는 범위. 커널에서는 {@code policy_id} 가 rule_* 맵 조회 키의 앞부분이 된다(§12).
 *
 * <p><b>여기 담기는 것은 사람이 읽는 표현이다.</b> {@code /usr/bin/git} 같은 경로로 적히고,
 * 실제 맵에 들어가는 {@code (dev, ino)} 로의 컴파일은 warrantd 가 노드에서 한다 —
 * inode 는 노드마다 다르고 패키지 업데이트로 바뀌기 때문이다(§15).
 */
// @Entity @Table(name = "policy")
public class Policy {

    private UUID id;

    private String name;

    /** 실행 허용 목록. <b>화이트리스트</b>다 — 여기 없으면 bprm_check_security 에서 막힌다. */
    private List<ExecRule> execRules;

    /** 쓰기 허용 목록. 디렉터리 단위. 읽기는 통제하지 않으므로 read 규칙은 존재하지 않는다(§15). */
    private List<WriteRule> writeRules;

    /** 아웃바운드 허용 대역. 커널에서는 LPM 트라이. 비어 있으면 전면 차단이다. */
    private List<NetRule> netRules;

    /**
     * UDP 경로({@code lsm/socket_sendmsg})까지 볼 것인가.
     * 비용이 오르므로 이 플래그가 있을 때만 attach 한다(§18).
     */
    private boolean inspectUdp;

    /**
     * 읽기 사실 자체를 남길 소수의 감시 대상 경로.
     * 읽기 통제를 포기한 대가를 부분적으로 메우는 장치이므로 <b>목록이 길어지면 안 된다</b>(§15).
     */
    private List<String> readWatchList;
}
