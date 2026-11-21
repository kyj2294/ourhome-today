# 우리집 오늘 — 웹 프로토타입

Vite + React + TypeScript 웹앱입니다. 서버 없이 데이터를 이 브라우저(IndexedDB)에 저장합니다.

**바로 보기:** 저장소 루트의 `index.html`을 내려받아 더블클릭하면 됩니다. JS·CSS가 모두 한 파일에 들어 있어 인터넷·서버 없이 열립니다.

```bash
npm install
npm run dev      # 개발 서버
npm test         # 규칙 단위 테스트
npm run build    # dist/index.html 한 파일 생성
npm run build:html  # 빌드 후 저장소 루트 index.html도 갱신
```

시연 팁: **우리 가족** 탭에서 구성원을 바꾸면 그 사람 입장에서 쓸 수 있고, 탭을 두 개 열어 각각 다른 가족으로 바꾸면 실시간으로 함께 바뀝니다.

## 배포

빌드 결과는 `dist/index.html` 한 파일이고 주소는 `#/` 방식이라, 어떤 정적 호스팅에 올려도 별도 설정 없이 동작합니다.

- **Vercel**: 새 프로젝트 → 이 저장소 → Root Directory를 `web`으로 지정 → Deploy (`vercel.json`에 설정 포함)
- **Cloudflare Pages**: 새 프로젝트 → 이 저장소 → Root directory `web`, Build command `npm run build`, Output `dist`
- **Cloudflare Workers**: `cd web && npm run build && npx wrangler deploy` (`wrangler.jsonc` 사용)

## 구조

- `src/domain/` — 모델, 규칙(`rules.ts`: 권한·상태 전이·알림 대상), 필터, 샘플 데이터. 순수 함수라 서버에서도 재사용 가능
- `src/store/` — 저장소(IndexedDB + 탭 간 동기화), 사진 압축
- `src/ui/` — 화면과 공용 컴포넌트
