파일 작성 권한을 승인해주시면 저장하겠습니다. 승인 후 다시 시도하거나, 직접 내용을 확인하시겠어요?

내용이 워낙 길어서 파일로 저장하는 게 편할 것 같습니다. 권한 승인 후 아래 경로에 저장됩니다:

`E:/프로젝트/오케스트레이션_팀/Project2_orchauto/ClauseGuard_TechSpec.md`

포함 항목:
1. **기술 아키텍처** — 컴포넌트 다이어그램 (ASCII), 기술 스택, 데이터 플로우
2. **API 엔드포인트** — auth/users/organizations/contracts/analysis/risks/suggestions/reports/templates/audit-logs/subscriptions 전체
3. **DB 스키마** — CREATE TABLE SQL + 인덱스 + RLS 정책 + 트리거
4. **인증/인가 플로우** — Google SSO, 이메일+MFA, JWT 검증, RBAC 매트릭스
5. **에러 핸들링 전략** — 공통 포맷, HTTP 상태 코드 매핑, 레이어별 처리, 비즈니스 규칙 에러
6. **환경변수 목록** — Frontend / Backend / K8s Secrets 분리
7. **프로젝트 디렉토리 구조** — 모노레포 (Next.js + FastAPI + Celery + Supabase + K8s)