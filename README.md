# 집지킴 360 — 프로토타입

빌라 AI 시세 · HUG 126% 안심진단 · 복비 0원 에스크로 직거래 · 원상복구 사진 금고.
모바일 앱(PWA)과 반응형 웹(데스크톱 ≥1024px: 상단 내비 + 목록/지도 분할)을 하나의 코드로 제공합니다. 빌드 도구나 npm 의존성은 없습니다.
백엔드는 Supabase(서울 리전)입니다. 매물 DB, 로그인, 클라우드 동기화, 사진 원본 보관, 서버 봉인 시각을 담당하며, 연결이 안 되면 로컬 데모로 동작합니다.

## 실행
```bash
node server.js
```
→ http://localhost:5173 (서비스워커·클립보드는 http(s)에서 동작)

## 구조
```
index.html          앱 셸 (웹 내비 + 모바일 탭바)
css/style.css       디자인 토큰, 모바일 → 데스크톱 반응형, 인쇄 스타일
js/data.js          데모 매물 10건, 특약, 체크포인트, 감가상각 참고값, PRD 변경점
js/engines.js       헤도닉 시세, HUG 판정, 8대 위험 진단, 중개보수, 감가상각, SHA-256/머클
js/app.js           해시 라우터(#/home, #/listing/:id, #/check/:id, #/contract, #/vault, #/report, #/my)
js/sb.js            Supabase 연동 (supabase-js CDN) — 매물 로드, 이메일 로그인, 찜·계약·금고 동기화, 실시간 반영
supabase/           마이그레이션(스키마·RLS·Storage) + 매물 시드
vercel.json         Vercel 정적 배포 설정
sw.js, manifest     PWA
PRD_ZIPJIKIM_360.md 정정판 PRD v1.1
PRD.md              Supabase 백엔드 연동 PRD v1.2
```

## 배포 (Vercel)
실서비스: **https://zip-ji-kim.vercel.app** (Vercel 프로젝트 `zip-ji-kim`, GitHub `main` 연동)

빌드 없이 저장소 루트를 정적 사이트로 배포합니다. vercel.com → Add New → Project → `ultraJH-collab/ZipJiKim` Import → Framework Preset **Other**, Build Command 비움 → Deploy. 이후 `main`에 push할 때마다 자동으로 배포됩니다.

Supabase Authentication → URL Configuration 설정: Site URL은 `https://zip-ji-kim.vercel.app`, Redirect URLs는 `https://zip-ji-kim.vercel.app/**`, `http://localhost:5173/**`입니다. 도메인이 바뀌면 여기도 함께 바꿔야 가입 인증 메일과 로그인 링크가 앱으로 돌아옵니다.

## 데모 시나리오
| 매물 | 확인 포인트 |
|---|---|
| 해오름빌라 (신림) | 안전 — 직거래 전 과정 시연 |
| 리치빌 (서원) | 보증금만 보면 통과, **근저당 합산 시 HUG 탈락** |
| 스카이빌 | 근생 위반건축물 |
| 트러스트빌 | 2개월 전 법인 명의변경 + 임차권등기명령 이력 |
| 하늘채빌라 | 신탁등기 → 계약 진행 차단 |
| 남현 우리집 | 다가구 선순위 보증금 합산 |

데이터 실연동 대상: 국토부 건축물대장·실거래가, 공시가격, 인터넷등기소, PASS/카카오 인증, 은행 에스크로, TSA.
