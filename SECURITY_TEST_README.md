# 와방 Cloudflare 무료 보안 테스트 v1

> **시험용 브랜치만 변경합니다.** 기존 \`skylee-lang/wa-bang\` 운영 저장소는 변경하지 않습니다.
> 이 저장소 자체는 **Public**입니다. 비밀키, 실제 문의, 실매물 원본 데이터, 관리자 자격증명을 커밋하지 마세요.

## 구현된 첫 단계

- Cloudflare **Pages Functions**: \`/api/health\`, \`/api/config\`, \`/api/session\`
- Turnstile 서버 검증 후 HMAC-SHA256 서명 **30분 세션 쿠키** 발급
- D1 매물 **목록 12개씩** / **상세 단일 ID** API (활성 매물만 노출)
- D1에 가상 문의 저장, **중복 요청 키** 검사
- 인증된 내부 동기화 API (\`SYNC_SECRET\`, 배치 최대 100개)
- 세션 기반 API 속도 제한, 입장 시 IP 기반 속도 제한
- \`/security-demo/\`에서 가상 매물로 기능 시험
- SQL 마이그레이션 및 가상 매물 4개

**미구현(운영에 배포 금지):** 기존 와방 메인/챗봇의 새 API 연동, 실제 시트 동기화, 관리자용 로그인, 사진 비공개 저장, 완전한 동시성/부하 테스트, 실서비스 배포. 기존 메인 \`index.html\`은 여전히 공개 CSV를 호출합니다.

## 배포 순서

1. 이 테스트 브랜치를 **별도의 Cloudflare Pages 테스트 프로젝트**에 GitHub 연동. Production branch를 이 테스트 브랜치로 지정하거나 Preview 브랜치에서 확인합니다. **기존 운영 도메인에는 연결하지 마세요.**
2. Cloudflare D1에서 새 테스트 DB \`wabang-test\` 생성.
3. D1 콘솔의 SQL 실행 메뉴로 \`migrations/0001_init.sql\`, \`migrations/0002_demo_data.sql\`을 순서대로 실행. 두 번째 파일은 실제 매물과 무관한 **가상 데이터**입니다.
4. Pages 프로젝트 → Settings → Functions → **D1 database bindings**에서 변수명 \`DB\`에 테스트 DB 연결. 필요 시 Production / Preview 각각 설정합니다.
5. Turnstile에서 테스트 도메인용 위젯을 생성. 사이트 키는 Pages 환경 변수 \`TURNSTILE_SITE_KEY\`, **비밀키**는 Pages 암호화 Secret \`TURNSTILE_SECRET\`로 설정합니다.
6. Pages 암호화 Secret \`SESSION_SECRET\`에 **32자 이상 랜덤값**을 설정. 내부 동기화 시험이 필요할 때만 \`SYNC_SECRET\`에도 별도의 32자 이상 랜덤값을 설정하세요.
7. 새로 배포 후 테스트 도메인의 \`/api/health\`, \`/security-demo/\`에 접속합니다. Cloudflare Pages에서 자동 생성된 API 경로만 작동합니다. **GitHub Pages에서 \`/api\`는 실행되지 않습니다.**

## 예상 결과와 보호 검사

| 검사 | 정상 기대 |
| --- | --- |
| \`GET /api/health\` | 200 + 서비스 상태 |
| \`GET /api/config\` | 비밀키 없이 준비 상태·공개 Turnstile 사이트키 |
| \`GET /api/listings\` (인증 전) | 401 |
| \`POST /api/session\` (위조 토큰) | 403 |
| Turnstile 인증 성공 | 200 + HttpOnly Secure 세션 쿠키 |
| \`GET /api/listings?page=1\` | 200, 최대 12건, 자세한 메모·사진 목록 제외 |
| \`GET /api/listings/DEMO-001\` | 200 + 그 매물의 상세 |
| \`GET /api/listings/DEMO-OLD\` | 404 (거래완료 비공개) |
| \`POST /api/inquiries\` (인증 전) | 401 |
| \`POST /api/internal/sync\` (비밀키 없음) | 401 |
| 동일 \`idempotencyKey\` 재요청 | 동일 문의번호 반환 |
| 다른 세션으로 기존 \`idempotencyKey\` 사용 | 409 |
| 잘못된 매물 ID 문의 | 409 또는 400 |

## 보안상 주의

- HMAC 30분 세션은 로그아웃/회수 기능이 없습니다. \`SESSION_SECRET\`을 바꾸면 기존 세션이 모두 무효화됩니다.
- 일반적인 세션별 요청 제한은 D1에 쓰기를 발생시킵니다. 무료 D1 쓰기 한도·공격 부하에 주의하고 상위 Cloudflare 방화벽/Rate Limiting과 함께 조정해야 합니다.
- \`CF-Connecting-IP\`는 Cloudflare 프록시를 통과한 실배포 환경에서만 신뢰할 수 있습니다.
- 현재 매물 URL 필드는 **임의 HTTPS 주소를 받는 테스트 수준**입니다. 실제 시트 연동 전 사진 호스트를 허용 목록으로 제한해야 합니다.
- 사진 링크는 현재 공개 URL이고 브라우저에 보이면 수집 가능합니다. R2 등 보호는 별도 단계입니다.
- 오픈카톡 복붙과 기존 챗봇·메인 화면은 아직 보안 API로 전환하지 않았습니다.
- 현행 공인중개사법 표시·광고 필수 항목은 실매물 전환 시 별도로 검토해야 합니다.
- 데이터 동기화 배치는 기존 ID를 자동 삭제하지 않으므로, 거래완료/삭제 상태를 명시적으로 보내야 합니다.
- 이 데모의 공개 인바운드 문의는 실제 상담 채널에 전달되지 않습니다.

## 무료 우선 선택

고정 월비용 0원을 목표로 Cloudflare Pages Functions + D1 + Turnstile을 선택했습니다. 각 무료 서비스의 실행·저장 한도 내에서만 정상 작동합니다. 비용·무료 한도는 Cloudflare 대시보드에서 확인해야 합니다.

## 다음 개발 단계

1. 기존 와방의 프론트엔드가 **공개 CSV 대신 목록/상세 API**를 사용하도록 단계적으로 변경
2. 원본 구글 시트 → **인증된 서버 동기화** 구현
3. 문의 저장 확정·중복·실패 재시도, 관리자 보호
4. 아이폰 Safari / 카카오톡 브라우저 / PC에서 회귀 테스트
5. 안전성 통과 후에만 운영 저장소 이관 검토
