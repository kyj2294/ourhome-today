# 우리집 오늘 — 웹 프로토타입

Vite + React + TypeScript 웹앱입니다. 가족 데이터와 사진은 **Supabase**에 저장되어 가족 모두의 기기에 실시간으로 함께 보입니다.

## 로그인

가입 없이 정해진 계정 4개로만 들어갑니다. 첫 화면에서 이름을 누르고 비밀번호 4자리를 누르면 됩니다.

| 계정 | 화면 | 예시 비밀번호 |
| --- | --- | --- |
| 엄마, 아빠 | 부모님 화면 (가족 단톡방처럼 큰 말풍선) | 1234 |
| 민수, 지은 | 자녀 화면 (전체 기능) | 1234 |

## Supabase 구조

- `oh_families`: 가족 문서 1개(`state` JSON) + `version` — 저장은 `oh_save_state(가족, 상태, 버전)` 함수로만, 버전이 맞을 때만
- `oh_members`: 로그인 계정 ↔ 가족 구성원 연결 (RLS: 자기 가족만 읽기)
- Storage `ourhome-photos`: 비공개, 가족 폴더만 올리기/보기. 화면에는 1년짜리 보기 링크 사용
- 여러 기기가 동시에 고치면: 나중에 저장하는 기기가 최신 상태를 받아 자기 행동을 다시 얹어 저장 (`src/remote/sync.ts`)
- 실시간: 저장한 기기가 Realtime broadcast로 신호 → 다른 기기가 바로 다시 읽음 (+30초마다, 앱으로 돌아올 때 확인)

**바로 보기:** https://ourhome-today.kimyj-financetest.workers.dev 또는 저장소 루트의 `index.html` (인터넷 연결 필요 — 로그인·데이터가 Supabase에 있음)

```bash
npm install
npm run dev      # 개발 서버
npm test         # 규칙 단위 테스트
npm run build    # dist/index.html 한 파일 생성
npm run build:html  # 빌드 후 저장소 루트 index.html도 갱신
```

시연 팁: **우리 가족** 탭에서 구성원을 바꾸면 그 사람 입장에서 쓸 수 있고, 탭을 두 개 열어 각각 다른 가족으로 바꾸면 실시간으로 함께 바뀝니다.

## 배포

**지금 배포된 주소:** https://ourhome-today.kimyj-financetest.workers.dev (Cloudflare Workers)

다시 배포할 때:

```bash
npm run deploy
```

빌드한 `dist/index.html`을 Worker(`worker/index.js`) 안에 넣어 그대로 돌려주는 방식입니다. Cloudflare 로그인(`npx wrangler login`) 또는 `CLOUDFLARE_API_TOKEN` 환경 변수가 필요합니다.

다른 곳에 올릴 때는 `index.html` 한 파일만 올리면 됩니다 (Vercel, Cloudflare Pages 끌어다 놓기 등). 주소는 `#/` 방식이라 별도 설정이 필요 없습니다.

## 구조

- `src/domain/` — 모델, 규칙(`rules.ts`: 권한·상태 전이·알림 대상), 필터, 샘플 데이터. 순수 함수라 서버에서도 재사용 가능
- `src/store/` — 저장소(Supabase 동기화·로그인 상태), 사진 압축
- `src/remote/` — Supabase 설정·호출, 여러 기기 동기화 규칙
- `src/ui/` — 화면과 공용 컴포넌트
