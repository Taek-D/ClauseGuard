# ClauseGuard 기술 실현가능성 분석

> 계약서 독소 조항 AI 탐지 및 리스크 분석 서비스로 가정

---

## 1. 추천 스택

### 프론트엔드: **Next.js 15 + TypeScript + Tailwind CSS**
- **이유**: App Router의 SSR로 SEO 확보, PDF 렌더링 등 무거운 작업을 서버 컴포넌트로 처리, Vercel 원클릭 배포

### 백엔드: **FastAPI (Python)**
- **이유**: LangChain/LlamaIndex 등 AI 라이브러리가 Python 생태계에 집중, async 지원으로 LLM 스트리밍 처리에 최적, PDF 파싱 라이브러리 풍부

### DB: **PostgreSQL (Supabase) + Redis**
- **PostgreSQL**: 계약서/분석 결과의 구조화 저장, pgvector로 임베딩 검색 병행
- **Redis**: LLM 응답 캐싱 (동일 조항 재분석 비용 절감), 세션 관리

### 배포: **Vercel (프론트) + Railway or Fly.io (백엔드)**
- **이유**: Vercel은 Next.js 최적화, Railway는 FastAPI 컨테이너 배포 간단, 초기 비용 낮음

---

## 2. MVP 기능

### Must-Have (출시 필수)
| # | 기능 | 설명 |
|---|------|------|
| 1 | **계약서 업로드 & 파싱** | PDF/DOCX 업로드 → 조항 단위 분리 |
| 2 | **독소 조항 탐지** | LLM으로 불공정/위험 조항 하이라이트 |
| 3 | **리스크 레벨 스코어링** | 조항별 위험도 (High/Medium/Low) 분류 |
| 4 | **요약 리포트 생성** | 전체 계약서 리스크 요약 + 수정 제안 |
| 5 | **결과 PDF 다운로드** | 분석 결과를 주석 포함 PDF로 내보내기 |

### Nice-to-Have (다음 버전)
| # | 기능 | 설명 |
|---|------|------|
| 1 | **업계별 기준 적용** | 소프트웨어/부동산/근로계약 등 도메인별 분석 |
| 2 | **조항 수정 제안** | 독소 조항 → 대안 문구 자동 생성 |
| 3 | **계약서 비교** | 2개 버전 간 변경사항 + 신규 리스크 탐지 |
| 4 | **팀 협업** | 코멘트 달기, 검토자 지정, 승인 워크플로우 |
| 5 | **API 제공** | B2B용 REST API (법무팀 내재화) |

---

## 3. 시스템 아키텍처

```
[클라이언트]
  Next.js App
    ├── 업로드 UI (PDF/DOCX Drag&Drop)
    ├── 분석 결과 뷰어 (조항 하이라이트)
    └── 리포트 대시보드

        │ HTTPS REST / SSE(스트리밍)
        ▼

[API Gateway - FastAPI]
  ├── /upload     → 파일 파싱 서비스
  ├── /analyze    → 분석 파이프라인 (비동기 큐)
  ├── /report     → 결과 조회
  └── /export     → PDF 생성

        │
        ├── [파싱 레이어]
        │     pdfplumber / python-docx
        │     → 조항 단위 청킹
        │
        ├── [AI 분석 레이어]
        │     LangChain + Claude API
        │     → 조항별 리스크 분류
        │     → 임베딩 → pgvector 유사 조항 검색
        │
        ├── [캐시 레이어]
        │     Redis (조항 해시 기반 캐싱)
        │
        └── [저장 레이어]
              PostgreSQL (Supabase)
                ├── users
                ├── contracts
                ├── clauses
                └── analysis_results
              S3 / Supabase Storage (원본 파일)
```

**분석 흐름:**
1. 업로드 → S3 저장 + 파싱 워커 실행
2. 조항 청킹 → 임베딩 생성 → pgvector 저장
3. 각 조항 → Claude API 병렬 분석 (asyncio)
4. 결과 집계 → 전체 리포트 생성
5. SSE로 프론트에 실시간 진행률 푸시

---

## 4. 외부 의존도

| 의존성 | 용도 | 대안 |
|--------|------|------|
| **Claude API** (Anthropic) | 핵심 분석 엔진 | GPT-4o, Gemini 1.5 Pro, 자체 파인튜닝 모델 |
| **Supabase** | DB + Auth + Storage | PlanetScale + Auth0 + AWS S3 |
| **pdfplumber** | PDF 파싱 | PyMuPDF, Adobe PDF Services API |
| **python-docx** | DOCX 파싱 | LibreOffice headless (변환 후 처리) |
| **Vercel** | 프론트 배포 | AWS Amplify, Netlify |
| **Railway** | 백엔드 배포 | Fly.io, Render, AWS ECS |

**핵심 리스크**: Claude API 단일 의존 → LiteLLM으로 멀티 LLM 추상화 레이어 구성 권장

---

## 5. 주간 개발 일정 (8주 MVP)

```
Week 1: 기반 설정
  - 프로젝트 구조, DB 스키마 설계
  - 인증 (Supabase Auth), 파일 업로드 API

Week 2: 파싱 엔진
  - PDF/DOCX 파싱 + 조항 청킹 알고리즘
  - 청킹 품질 테스트 (다양한 계약서 샘플)

Week 3: AI 분석 파이프라인
  - 조항 분류 프롬프트 엔지니어링
  - 병렬 분석 + Redis 캐싱

Week 4: 결과 저장 & 조회 API
  - 분석 결과 DB 저장
  - SSE 스트리밍 (실시간 진행률)

Week 5: 프론트 - 업로드 & 분석 뷰
  - 계약서 업로드 UI
  - 조항 하이라이트 뷰어

Week 6: 프론트 - 리포트 대시보드
  - 리스크 스코어 시각화
  - 조항별 상세 설명 패널

Week 7: PDF 내보내기 + 폴리싱
  - ReportLab/WeasyPrint로 리포트 PDF 생성
  - UX 개선, 로딩 상태, 에러 처리

Week 8: 테스트 & 배포
  - 다양한 계약서 유형 QA
  - 프로덕션 배포 + 모니터링 설정
```

---

## 6. 기술 리스크 3가지

### 리스크 1: LLM 분석 정확도 불일치
**문제**: 동일 조항에 대해 LLM이 매번 다른 리스크 레벨을 반환, 법적 신뢰도 문제  
**완화**:
- Few-shot 예제 100개 이상으로 프롬프트 고정
- 신뢰도 낮은 결과는 재분석 후 다수결
- "AI 보조 도구"임을 명시하는 면책 문구 UI 삽입

### 리스크 2: 복잡한 PDF 파싱 실패
**문제**: 스캔본 PDF, 표 안의 조항, 다단 레이아웃에서 텍스트 추출 오류  
**완화**:
- pdfplumber 실패 시 OCR 폴백 (Tesseract/AWS Textract)
- 파싱 신뢰도 점수 계산, 낮으면 사용자에게 경고
- 초기 MVP는 "텍스트 기반 PDF/DOCX"로 지원 범위 한정

### 리스크 3: API 비용 폭발
**문제**: 100페이지 계약서 × 다수 사용자 = Claude API 비용 급증  
**완화**:
- 조항 해시 기반 Redis 캐싱 (동일 조항 재청구 없음)
- 무료 플랜: 페이지 수 제한 (최대 20페이지)
- Haiku 모델로 1차 필터링 → Sonnet은 High 리스크 조항만 재분석
- 월별 API 비용 알림 설정

---

> Claude는 완벽하지 않습니다. 중요한 결정은 항상 확인하세요.