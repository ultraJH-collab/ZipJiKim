# [PRD] 집지킴 360 — Supabase 백엔드 연동 v1.2.0

| 항목 | 내용 |
|---|---|
| 제품명 | 집지킴 (ZipJikim) 360 |
| 버전 | v1.2.0 (Supabase 백엔드 연동) |
| 선행 문서 | `PRD_ZIPJIKIM_360.md` v1.1.0 — 기능 요구사항(FR-1.x ~ FR-4.x)의 원본. 본 문서는 그 기능을 실제 백엔드로 옮기는 범위만 정의 |
| 작성 일자 | 2026-10-21 |
| 문서 상태 | 초안 — 스키마·RLS 리뷰 및 개인정보 영향평가 필요 |
| 백엔드 | Supabase (Postgres · Auth · Storage · Realtime · Edge Functions · pg_cron) |
| 리전 | `ap-northeast-2` (서울) — 개인정보·등기 데이터 국내 보관 |

---

## 0. 배경과 목표

현재 프로토타입은 **모든 데이터가 목업이거나 브라우저 localStorage에만 존재**한다.

| 현재 (v1.1 프로토타입) | 한계 |
|---|---|
| `ZJ.LISTINGS` 10건 하드코딩 | 매물 등록·검색 불가 |
| 본인인증 시뮬레이션 | 임대인 ↔ 등기 소유자 검증 불가 |
| `state.ct` localStorage 저장 | 임대인·임차인이 **각자 기기에서 같은 계약에 서명할 수 없음** |
| 사진 금고 = 축소 JPEG data URL in localStorage | 수 MB 한도로 12장 원본 보관 불가, 기기 분실 시 증거 소실 |
| 서버 시각·TSA 없음 (기기 시각 사용) | 증거력 부족 (v1.1 정정 #5·#6 미구현) |
| 등기 감시·알림 없음 | FR-2.4 실시간 등기 감시 불가 |

### 목표
1. **양측 실사용 흐름**: 임대인과 임차인이 각자의 계정으로 같은 계약을 실시간 진행.
2. **증거 보존**: 사진 원본·해시·서버 수신 시각·머클 루트를 서버에 변조 불가 형태로 보관.
3. **실데이터 연동**: 공공데이터(건축물대장·공시가격·실거래가)를 서버에서 수집해 시세·진단 엔진에 공급.
4. **지속 감시**: 계약 이후 등기 변동·만기 일정을 서버가 주기적으로 감시하고 알림.

### 비목표 (v1.2 범위 밖)
- 실제 은행 에스크로 계좌 개설(제휴 계약 전까지 샌드박스 유지)
- PASS 본인확인 실서비스 계약(인터페이스만 정의, 샌드박스 사용)
- 네이티브 앱(PWA 유지)

### 제약
- **빌드 없는 구조 유지**: `supabase-js`를 CDN `<script>`로 로드하고 `window.supabase`를 사용한다. 번들러 도입 금지.
- **오프라인 우선 유지**: 비로그인·오프라인에서도 기존 데모가 동작해야 한다(로그인 시에만 서버 동기화).
- `sw.js`는 앱 셸만 캐시하고 `*.supabase.co` 요청은 캐시하지 않는다.

---

## 1. 아키텍처

```
[PWA / 반응형 웹]  index.html → data.js → engines.js → sb.js(신규) → app.js
        │  supabase-js (CDN)
        ▼
┌──────────────────────── Supabase ────────────────────────┐
│ Auth        : 카카오 OAuth · 휴대폰 OTP · 이메일 매직링크 │
│ Postgres    : 도메인 테이블 + RLS + PostGIS + pgvector   │
│ Storage     : vault-photos · documents · signatures      │
│ Realtime    : contracts / escrow / chat / inspection     │
│ Edge Func.  : 공공데이터 프록시 · 서버 판정 · 봉인 · 웹훅 │
│ pg_cron     : 등기 감시 · 실거래 갱신 · 만기 알림        │
└──────────────────────────────────────────────────────────┘
        │
        ▼  외부: 국토부/공공데이터포털 API · 등기정보 · TSA · PG/은행 · 알림톡
```

- 신규 파일 `js/sb.js`: Supabase 클라이언트 초기화와 데이터 접근 함수(`ZJ.sb.*`)만 담는다. `app.js`는 `ZJ.sb`를 통해서만 서버를 호출한다.
- `engines.js`의 순수 함수(`hug`, `diagnose`, `estimate`, `sha256`, `merkle`)는 **Edge Function(Deno)에서도 그대로 import**해 클라이언트·서버 판정 결과를 일치시킨다.
- 금액 단위: 매물·진단 데이터는 기존 규칙대로 **만원 정수**(`*_man` 컬럼), 결제·에스크로는 **원 정수**(`*_won` bigint).

---

## 2. 기능 요구사항

### 모듈 A — 인증과 계정 (Supabase Auth)

- **FR-A.1 로그인**: 카카오 OAuth(기본), 휴대폰 OTP, 이메일 매직링크. 비로그인 상태에서는 탐색·진단만 가능하며 계약·금고는 로그인 필요.
- **FR-A.2 역할**: `profiles.role ∈ {tenant, landlord, agent, admin}`. 한 사용자가 임차인·임대인 역할을 겸할 수 있으므로 역할은 계약 단위(`contract_parties.role`)로도 기록한다.
- **FR-A.3 본인확인 (FR-3.1 연동)**: Edge Function `verify-identity`가 PASS/카카오 인증서 결과(CI 해시, 실명)를 받아 `identity_verifications`에 저장. **CI 원문은 저장하지 않고 해시만 보관**.
- **FR-A.4 임대인-소유자 일치 검증**: 인증 실명과 등기부 소유자명 비교 결과를 `listings.landlord_verified`에 기록. 불일치·신탁 주택은 계약 생성 차단(DB 트리거로 강제).
- **FR-A.5 기기 간 동기화**: 로그인 시 localStorage의 관심 매물·진행 중 계약·금고 메타를 서버로 1회 이관(§5).

### 모듈 B — 매물과 탐색 (Postgres + PostGIS)

- **FR-B.1 매물 DB**: `ZJ.LISTINGS`를 `listings` 테이블로 이관(시드 마이그레이션). 매물 등록은 **인증된 임대인 본인만** 가능(v1.1 §7 무등록 중개 회피 원칙).
- **FR-B.2 지도 검색**: `location geography(Point)` + GiST 인덱스. 현재 지도 뷰포트(bbox) 또는 반경 검색 RPC `search_listings(bbox, filters)`.
- **FR-B.3 필터·정렬**: 전세/월세, 유형, 보증금 범위, 안심등급(0/1/2), 승강기 여부. 안심등급은 `diagnoses` 최신 행을 조인.
- **FR-B.4 관심 매물**: `favorites`. 관심 매물의 등기·가격 변동 시 알림(모듈 F).
- **FR-B.5 유사 매물 추천 (pgvector)**: 면적·연식·층·위치·가격을 정규화한 벡터로 근접 매물 5건 추천.

### 모듈 C — 시세·진단 실데이터 (Edge Functions)

- **FR-C.1 공공데이터 프록시**: Edge Function `public-data`가 건축물대장 표제부, 공동주택/개별단독 공시가격, 연립다세대 실거래가를 조회. **API 키는 Supabase Secrets에만 보관**, 응답은 `building_registers`·`official_prices`·`transactions`에 캐시(TTL 24h).
- **FR-C.2 실거래 비교사례**: 현재 시드 RNG로 생성하는 `comps`를 `transactions` 테이블 조회(반경 500m·12개월, PostGIS)로 대체. 표본 부족 시 기존 시드 생성 로직으로 폴백하고 "추정(표본 부족)" 라벨 표시.
- **FR-C.3 서버 판정**: Edge Function `diagnose`가 `engines.js`의 `hug`·`diagnose`를 서버에서 재실행해 `diagnoses`에 저장. 계약 생성·에스크로 정산은 **서버 판정 결과만 신뢰**(클라이언트 값은 표시용).
- **FR-C.4 진단 이력**: 동일 매물의 진단 결과를 시계열로 보관해 "지난 진단 대비 변동"(근저당 추가, 공시가 하락 등) 표시.
- **FR-C.5 등기부 업로드 (선택)**: 등기정보 API 계약 전까지 사용자가 등기부 PDF를 `documents` 버킷에 업로드하면 수동 검토 큐(`registry_reviews`)에 등록.

### 모듈 D — 양측 전자계약 (Postgres + Realtime)

- **FR-D.1 계약 테이블화**: `state.ct`를 `contracts`(본문·단계·조건) + `contract_parties`(당사자·역할·서명 여부)로 분리. 단계 enum은 기존 위저드와 동일: `auth → terms → clauses → sign → escrow → done`.
- **FR-D.2 초대**: 임차인이 계약을 만들면 임대인에게 초대 링크(`contract_invites`, 72시간 만료 토큰) 발송. 임대인 수락 시 `contract_parties`에 추가.
- **FR-D.3 실시간 동기화**: Realtime Postgres Changes로 `contracts` 행을 구독. 상대방이 조건 수정·특약 추가·서명하면 내 화면이 즉시 갱신(`render(true)`).
- **FR-D.4 동시 편집 표시**: Realtime Presence로 "임대인이 지금 보고 있음" 표시. 조건 수정 충돌은 `version` 컬럼 낙관적 잠금으로 처리.
- **FR-D.5 서명·봉인**: 서명 이미지 → `signatures` 버킷, 문서 SHA-256 → `contract_seals`. 양측 서명 완료 시 Edge Function `seal-contract`가 서버 시각·문서 해시로 **RFC 3161 TSA 토큰**을 받아 저장. 봉인 후 계약 본문 UPDATE는 트리거로 차단.
- **FR-D.6 무결성 재검증**: 누구나 계약 ID로 `verify_seal(contract_id)` RPC 호출 → 저장된 해시·TSA 토큰과 재계산 해시 비교 결과 반환.
- **FR-D.7 직거래 메시지**: 계약별 채팅 `messages`(Realtime). 연락처·계좌번호 패턴은 서버에서 마스킹 경고(외부 송금 유도 사기 차단).

### 모듈 E — 에스크로 (Edge Functions + 웹훅)

- **FR-E.1 가상계좌 발급**: Edge Function `escrow-create`가 제휴 은행/PG 샌드박스 API로 가상계좌 발급, `escrows`에 저장. 범위: 계약금만 / 계약금+잔금(권장).
- **FR-E.2 입금 웹훅**: `escrow-webhook`이 서명 검증 후 상태 갱신 `pending → deposited → held → released | refunded`. 모든 전이는 `escrow_events`(append-only)에 기록.
- **FR-E.3 정산 조건 자동 판정**: 정산은 ① 전입신고 익일 0시 경과 ② 감시 기간 등기 무변동 ③ 서버 판정 `level < 2` 를 모두 만족할 때만. 하나라도 실패 시 자동 보류 + 양측 알림.
- **FR-E.4 실시간 상태**: Realtime으로 에스크로 진행 바를 양측 화면에 동시 반영.

### 모듈 F — 감시와 알림 (pg_cron + pg_net)

- **FR-F.1 등기 감시 (FR-2.4)**: 활성 계약의 감시 기간(계약금 예치 ~ 전입 익일 0시 + 24h) 동안 **1시간 간격**으로 `registry-watch` 함수 호출. 갑구·을구 변동 감지 시 `registry_events` 기록 → 에스크로 보류 → 알림.
- **FR-F.2 2년 안심케어**: 구독자의 계약 주택을 **1일 1회** 감시(근저당 추가, 경매개시, 압류).
- **FR-F.3 실거래 갱신**: 매일 04:00 KST 관심 지역 실거래가 수집 → 관심 매물의 AI 시세·전세가율 재계산 → 깡통전세 지수 임계(70/80%) 돌파 시 알림.
- **FR-F.4 일정 알림**: 전월세 신고 기한(계약 후 30일), 확정일자, 반환보증 가입, 계약 만기 D-90/D-30, 갱신요구권 행사 기한.
- **FR-F.5 알림 채널**: 앱 내 알림(`notifications` + Realtime) 기본, 웹 푸시(PWA), 카카오 알림톡(Edge Function `notify`). 사용자별 채널 설정 `notification_prefs`.

### 모듈 G — 원상복구 사진 금고 (Storage)

- **FR-G.1 원본 업로드**: 12 체크포인트 사진을 비공개 버킷 `vault-photos/{vault_id}/{phase}/{checkpoint}.jpg`에 원본 업로드. 화면 표시는 클라이언트 썸네일 + 서명 URL.
- **FR-G.2 서버 해시·시각 (v1.1 정정 #6)**: 업로드 후 Edge Function `vault-ingest`가 Storage 객체를 다시 읽어 SHA-256 계산 → 클라이언트 해시와 비교 → 일치 시 `vault_photos.server_received_at`(서버 시각) 기록. 불일치 시 거부.
- **FR-G.3 머클 봉인**: 입주/퇴거 단계별로 12장 해시의 머클 루트를 `vault_seals`에 저장 + TSA 토큰. 봉인 후 해당 단계 사진 교체·삭제 불가(Storage 정책 + 트리거).
- **FR-G.4 공동 확인**: 임대인을 금고에 초대해 입주 사진에 "확인함" 서명. 퇴거 점검은 Realtime으로 양측이 같은 체크포인트를 보며 항목별 판정(이상없음/자연마모/임차인 과실) 합의.
- **FR-G.5 리포트 공유**: `report-pdf` 함수가 소명 리포트 PDF를 생성해 `documents`에 저장, 7일 만료 공유 링크 발급(분쟁조정위원회 제출용).

### 모듈 H — 특약·통계 (부가)

- **FR-H.1 특약 라이브러리**: 특약을 `clauses` 테이블로 이관(주택 유형별 노출 조건 포함). 변호사 감수 버전 관리(`reviewed_by`, `reviewed_at`) — **감수 전 버전은 "데모 문구" 라벨 유지**.
- **FR-H.2 특약 검색 (pgvector)**: "반려동물", "곰팡이" 등 자연어로 상황별 특약 추천.
- **FR-H.3 지역 위험 통계**: 동 단위 위험 매물 비율·평균 전세가율 머티리얼라이즈드 뷰(일 1회 갱신). 개인 식별 불가능한 집계만 공개.

---

## 3. 데이터 모델

> 모든 테이블에 `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()` 공통. 금액은 `_man`(만원 int) / `_won`(원 bigint).

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `profiles` | `user_id (fk auth.users)`, `display_name`, `role`, `phone_masked` | auth 가입 트리거로 생성 |
| `identity_verifications` | `user_id`, `provider`, `ci_hash`, `real_name_enc`, `verified_at` | 실명은 pgsodium 암호화 |
| `listings` | `owner_id`, `name`, `addr`, `dong`, `type`, `deal`, `deposit_man`, `rent_man`, `area_m2`, `rooms`, `floor`, `floors`, `year`, `elevator`, `parking`, `violation`, `official_price_man`, `location geography`, `landlord_verified`, `status` | `ZJ.LISTINGS` 필드와 1:1 대응 |
| `listing_rights` | `listing_id`, `section(gap/eul)`, `date`, `type`, `cause`, `amount_man`, `holder` | 기존 `gap`/`eul` 배열 정규화 |
| `building_registers` | `pnu`, `raw jsonb`, `violation`, `use_approval_date`, `fetched_at` | 공공데이터 캐시 |
| `official_prices` | `pnu`, `unit`, `year`, `price_man` | |
| `transactions` | `location`, `deal_date`, `area_m2`, `floor`, `year_built`, `price_man`, `source` | 실거래 (comps 원천) |
| `diagnoses` | `listing_id`, `deposit_man`, `level`, `score`, `hug jsonb`, `items jsonb`, `engine_version`, `source(client/server)` | 시계열 |
| `favorites` | `user_id`, `listing_id` | unique(user, listing) |
| `contracts` | `listing_id`, `step`, `terms jsonb`, `clause_ids uuid[]`, `version`, `sealed_at`, `move_in_date`, `status` | |
| `contract_parties` | `contract_id`, `user_id`, `role(tenant/landlord)`, `signed_at`, `signature_path` | |
| `contract_invites` | `contract_id`, `token_hash`, `expires_at`, `accepted_by` | |
| `contract_seals` | `contract_id`, `doc_sha256`, `tsa_token bytea`, `tsa_time` | append-only |
| `messages` | `contract_id`, `sender_id`, `body`, `flagged` | |
| `escrows` | `contract_id`, `scope`, `amount_won`, `vaccount_masked`, `status` | |
| `escrow_events` | `escrow_id`, `from_status`, `to_status`, `reason`, `payload jsonb` | append-only |
| `watches` | `contract_id`/`user_id`, `pnu`, `interval`, `starts_at`, `ends_at`, `last_snapshot jsonb` | 등기 감시 대상 |
| `registry_events` | `watch_id`, `diff jsonb`, `severity` | append-only |
| `vaults` | `contract_id`, `owner_id`, `landlord_id` | |
| `vault_photos` | `vault_id`, `phase(in/out)`, `checkpoint`, `storage_path`, `client_sha256`, `server_sha256`, `server_received_at`, `verdict` | |
| `vault_seals` | `vault_id`, `phase`, `merkle_root`, `tsa_token`, `sealed_at` | append-only |
| `clauses` | `code`, `title`, `body`, `house_types text[]`, `embedding vector`, `reviewed_by`, `reviewed_at` | |
| `notifications` | `user_id`, `kind`, `title`, `body`, `link`, `read_at` | Realtime 구독 |
| `notification_prefs` | `user_id`, `push`, `alimtalk`, `email` | |
| `audit_log` | `actor_id`, `action`, `target`, `meta jsonb` | append-only, 관리자만 조회 |

**append-only 강제**: `contract_seals`, `escrow_events`, `registry_events`, `vault_seals`, `audit_log`는 UPDATE·DELETE를 RLS에서 거부하고, `service_role`도 트리거로 차단한다.

### 필요 확장
`postgis`, `vector`, `pg_cron`, `pg_net`, `pgsodium`(또는 Vault)

---

## 4. 권한 (RLS) 매트릭스

| 리소스 | 비로그인 | 임차인(당사자) | 임대인(당사자) | 제3자 로그인 | 관리자 |
|---|---|---|---|---|---|
| `listings` (공개 상태) | 읽기 | 읽기 | 읽기·본인 매물 쓰기 | 읽기 | 전체 |
| `listing_rights`, `diagnoses` | 읽기(요약) | 읽기 | 읽기 | 읽기 | 전체 |
| `contracts`, `contract_parties` | ✕ | 읽기·쓰기(봉인 전) | 읽기·쓰기(봉인 전) | ✕ | 읽기 |
| `messages` | ✕ | 읽기·쓰기 | 읽기·쓰기 | ✕ | 신고 건만 |
| `escrows` | ✕ | 읽기 | 읽기 | ✕ | 읽기 |
| `escrow_events` | ✕ | 읽기 | 읽기 | ✕ | 읽기 (쓰기는 Edge Function만) |
| `vault_photos` / Storage | ✕ | 읽기·쓰기(봉인 전) | 초대 시 읽기 | ✕ | 분쟁 건만 |
| `identity_verifications` | ✕ | 본인만 | 본인만 | ✕ | ✕ (마스킹 뷰만) |
| `notifications` | ✕ | 본인만 | 본인만 | 본인만 | ✕ |

- 당사자 판정 헬퍼: `is_party(contract_id) returns bool` (`security definer`, `contract_parties` 조회).
- Storage 정책은 경로의 `vault_id`·`contract_id`로 동일 헬퍼를 사용.
- 클라이언트에는 **anon/publishable key만** 노출. `service_role` 키는 Edge Function Secrets에만 둔다.

---

## 5. 클라이언트 연동과 마이그레이션

- **로딩 순서**: `data.js → engines.js → supabase-js(CDN) → sb.js → app.js`. CDN 로드 실패 시 `ZJ.sb.enabled = false`로 기존 목업 모드 동작.
- **데이터 소스 전환**: `ZJ.sb.listings()`가 서버 응답을 기존 `ZJ.LISTINGS`와 같은 형태로 변환해 반환 → `app.js`의 뷰 함수는 수정 최소화.
- **localStorage 이관 (FR-A.5)**: 첫 로그인 시 `zj_` 키를 읽어 관심 매물·진행 중 계약·금고 메타를 업로드하고 `zj_migrated_at` 기록. 사진은 data URL이 축소본이므로 **"원본 재업로드 권장"** 배너 표시.
- **상태 저장 원칙**: 로그인 시 서버가 단일 원본(source of truth), localStorage는 오프라인 캐시. 오프라인 중 변경은 큐(`zj_outbox`)에 쌓았다가 재연결 시 전송, `version` 충돌 시 서버 우선 + 사용자 알림.
- **Service Worker**: `*.supabase.co`는 network-only. 셸 파일 추가 시 `CACHE` 버전 증가.
- **라우터**: 신규 화면 `#/login`, `#/invite/<token>`, `#/notifications`, `#/verify/<contractId>`(공개 무결성 검증).

---

## 6. Edge Functions 목록

| 함수 | 트리거 | 역할 |
|---|---|---|
| `verify-identity` | 클라이언트 | 본인확인 결과 검증·저장, 임대인-소유자 일치 판정 |
| `public-data` | 클라이언트 / cron | 건축물대장·공시가·실거래 조회 및 캐시 |
| `diagnose` | 클라이언트 / DB 트리거 | `engines.js` 서버 실행, `diagnoses` 저장 |
| `seal-contract` | 양측 서명 완료 | 문서 해시 + TSA 토큰, 봉인 |
| `escrow-create` | 클라이언트 | 가상계좌 발급(샌드박스) |
| `escrow-webhook` | PG/은행 | 서명 검증, 상태 전이 |
| `escrow-settle` | cron | 정산 조건 판정 → 지급/보류 |
| `registry-watch` | cron (1h / 1d) | 등기 스냅샷 비교, 변동 이벤트 |
| `vault-ingest` | Storage 업로드 후 | 서버 해시·수신 시각 기록 |
| `report-pdf` | 클라이언트 | 소명 리포트 PDF 생성·공유 링크 |
| `notify` | DB 트리거 | 웹 푸시·알림톡 발송 |

---

## 7. 비기능 요구사항

1. **보안**: 실명·CI는 암호화 또는 해시만 저장, 계좌번호는 마스킹 저장. 모든 테이블 RLS 활성화(Supabase Advisors 경고 0건이 출시 조건). 웹훅은 HMAC 서명 검증.
2. **개인정보**: 개인정보 보호법 기준 수집 항목·보유기간 고지. 계약 종료 + 법정 보존기간 경과 후 등기 스냅샷·사진 파기 배치. 위치는 매물 좌표만 저장, 사용자 위치는 저장하지 않음.
3. **성능**: 지도 bbox 검색 p95 300ms, 주소 → 서버 판정 p95 3초(공공데이터 캐시 hit 시 1초).
4. **가용성**: Supabase 장애 시 목업 모드로 탐색·진단 계속 가능. 감시 cron 실패 시 재시도 3회 + 관리자 알림.
5. **관측성**: Edge Function 로그, `audit_log`, cron 실행 이력(`cron.job_run_details`) 주간 점검.
6. **비용**: Storage 사진은 업로드 전 최대 2560px 리사이즈 옵션(원본 해시는 리사이즈 전 파일 기준 유지), 공공데이터 응답 캐시로 호출량 절감.

---

## 8. 법률·운영 고려 (v1.1 §7 보완)

- 서버가 거래 당사자의 메시지·계약을 보관하더라도 **가격 협상·알선에 개입하지 않음**을 유지. 추천·매칭 기능은 조건 필터 수준으로 제한.
- 에스크로 자금 흐름은 제휴 은행 신탁계좌 구조로만 운영(회사 계좌 경유 금지) — 전자금융거래법 검토 필요.
- 사진·계약 증거의 증거능력: 서버 수신 시각 + 원본 해시 + TSA 토큰을 근거로 하며, **블록체인 앵커링은 선택**(v1.1 정정 #5).
- 특약·감가상각 내용연수는 계속 "데모 문구 / 검증 필요" 라벨 유지, 감수 완료 버전만 라벨 해제.

---

## 9. 단계별 로드맵

| 단계 | 기간 | 범위 | 완료 기준 |
|---|---|---|---|
| **P0 기반** | 1주 | 프로젝트 생성(서울 리전), 확장 설치, `sb.js`, Auth(카카오·OTP), `profiles`, 매물 시드 이관 | 로그인 후 서버 매물로 홈 화면 렌더, 비로그인 목업 모드 정상 |
| **P1 계약** | 2주 | `contracts`·`contract_parties`·초대·Realtime·서명 Storage·`seal-contract` | 서로 다른 두 기기에서 한 계약을 끝까지 서명·봉인, 무결성 재검증 통과 |
| **P2 금고** | 1주 | `vault-photos` 버킷, `vault-ingest`, 머클 봉인, 임대인 공동 확인 | 12장 원본 업로드 후 서버 해시 일치, 봉인 후 교체 불가 |
| **P3 실데이터** | 2주 | `public-data`, `transactions` 기반 comps, 서버 `diagnose` | 실주소 입력 시 공공데이터 기반 HUG 판정, 클라이언트·서버 판정 일치 |
| **P4 감시·알림** | 1주 | `watches`, `registry-watch` cron, 일정 알림, 웹 푸시 | 테스트 등기 변동 주입 시 1시간 내 알림 + 에스크로 보류 |
| **P5 에스크로** | 1주 | 샌드박스 가상계좌, 웹훅, 정산 판정 | 샌드박스 입금 → held → 조건 충족 시 released 전 과정 로그 |
| **P6 부가** | 선택 | pgvector 특약·유사 매물, 지역 통계, 채팅 마스킹 | — |

---

## 10. 수용 기준 (요약)

- [ ] 모든 public 스키마 테이블 RLS 활성, Supabase Advisors 보안 경고 0건
- [ ] 제3자 계정으로 타인 계약·사진·메시지 조회 시 0행 반환(테스트 계정으로 검증)
- [ ] append-only 테이블에 UPDATE/DELETE 시도 시 실패
- [ ] 봉인된 계약·금고의 본문/사진 변경 시도 실패, `verify_seal` 결과 일치
- [ ] Supabase 연결 불가 상태에서 기존 데모(탐색·진단·로컬 계약·로컬 금고) 정상 동작
- [ ] `engines.js` 동일 입력에 대해 클라이언트·Edge Function 결과 동일

---

## 11. 미결 사항

1. 등기정보 실시간 조회 API 공급자 선정(인터넷등기소 연계 사업자 vs 수동 업로드 유지)
2. 본인확인 사업자(PASS/카카오 인증서) 계약 및 CI 처리 방식
3. TSA 공급자(국내 공인 TSA vs 해외 RFC 3161 서비스)
4. 에스크로 제휴 은행 및 가상계좌 수수료 구조
5. 사진 원본 보관 기간과 분쟁 시 연장 정책
6. 임대인 미가입 상태에서의 계약 초대 UX(카카오톡 링크 공유 허용 여부)
