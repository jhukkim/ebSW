package io.seswar.warrant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Session Warrant 컨트롤 플레인.
 *
 * <p>이 프로세스가 죽어도 이미 발급된 영장의 만료와 강제는 노드에서 계속된다(§17).
 * 강제 경로는 커널에 있어서 단단하게 실패하고, 발급 경로는 유저 공간에 있어서 느슨하게 실패한다 —
 * 이 비대칭이 의도된 설계이므로, 여기에 가용성 장치를 덧붙여 fail-close 로 만들지 말 것.
 */
@SpringBootApplication
public class WarrantServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(WarrantServerApplication.class, args);
    }
}
