25개 파일 전부 정상 생성 확인. 구조 요약:

```
ClauseGuard/
├── types/
│   └── index.ts              # RiskLevel, Contract, ContractAnalysis 등 전체 타입
├── lib/
│   ├── database.types.ts     # Supabase DB 타입 (contracts, analyses, profiles)
│   ├── supabase.ts           # Supabase 클라이언트 + 파일 업로드/삭제
│   ├── api.ts                # contractsApi, analysisApi (auth 헤더 자동 주입)
│   └── utils.ts              # cn, formatFileSize, formatDate, formatRelativeDate
├── store/
│   ├── useAuthStore.ts       # Zustand: signIn/signUp/signOut/fetchProfile
│   └── useContractStore.ts   # Zustand: 목록/상세/업로드/삭제/분석 트리거
└── components/
    ├── ui/
    │   ├── Button.tsx         # CVA 5 variants, 3 sizes, loading state
    │   ├── Badge.tsx          # 리스크·상태 배지 (CVA)
    │   ├── Modal.tsx          # Escape/backdrop click 닫기, body scroll lock
    │   ├── Input.tsx          # label/error/hint
    │   ├── Select.tsx         # options array 기반
    │   ├── FileUpload.tsx     # 드래그앤드롭, PDF/DOC/DOCX 검증, 20MB 제한
    │   ├── LoadingSpinner.tsx
    │   └── EmptyState.tsx
    ├── contract/
    │   ├── ContractCard.tsx        # hover 시 액션 표시, 리스크 수 요약
    │   ├── ContractList.tsx        # 페이지네이션, 로딩/에러/빈 상태
    │   ├── ContractStatusBadge.tsx # analyzing 시 pulse 애니메이션
    │   └── UploadModal.tsx         # 전체 업로드 폼 + 유효성 검사
    ├── analysis/
    │   ├── RiskBadge.tsx       # dot 옵션 포함
    │   ├── RiskSummary.tsx     # 스택 바 차트 + 4단계 카운트 그리드
    │   ├── ClauseCard.tsx      # 아코디언: 원문/설명/권고사항
    │   └── AnalysisResult.tsx  # 필터 + ClauseCard 목록 + 요약
    └── layout/
        ├── Navbar.tsx          # sticky, 사용량 표시, 로그아웃
        └── Sidebar.tsx         # active state 감지 (usePathname)
```

**필요한 패키지** (아직 설치 안 됐다면):
```bash
npm install zustand class-variance-authority clsx tailwind-merge @supabase/supabase-js
```

Claude는 완벽하지 않습니다. 중요한 결정은 항상 확인하세요.