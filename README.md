# 우리집 오늘 (Android 프로토타입)

따로 사는 부모님과 성인 자녀가 **사진·일상을 나누고**, 필요할 때만 **같은 게시물에서 일정이나 부탁으로 연결**하는 가족 SNS의 안드로이드 앱 뼈대입니다.

- 언어/UI: Kotlin + Jetpack Compose (Material 3)
- 구조: 단일 Activity + Navigation Compose + ViewModel
- 데이터: 지금은 **메모리 저장소 + 샘플 데이터**(앱을 끄면 초기화). 서버는 아직 없음

## 실행하기

**A. Android Studio**
1. Android Studio에서 `Open` → 이 폴더 선택
2. Gradle 동기화가 끝나면 에뮬레이터나 휴대폰을 골라 ▶ Run

**B. APK만 받아서 설치**
GitHub에 push하면 Actions(`Android build`)가 APK를 빌드합니다.
Actions 탭 → 해당 실행 → Artifacts의 `ourhome-today-debug-apk`를 내려받아 휴대폰에 설치하세요.

## 시연 방법

앱은 `민수(아들)` 입장으로 시작합니다. **우리 가족** 탭에서 구성원을 바꾸면 다른 가족 입장에서 같은 데이터를 볼 수 있습니다.

기획서의 *정수기 필터* 흐름:
1. 가족 소식에서 엄마의 "정수기 필터" 글 → 연결된 부탁 카드를 누름
2. 민수로 **제가 챙길게요** → 담당 표시 (지은으로 바꿔 다시 맡으려 하면 "민수님이 이미 맡았어요")
3. 민수로 **주문했어요**
4. 엄마로 바꿔서 **받았어요** → 완료. 원글 카드에도 같은 최신 상태가 보임

일정 흐름: 민수의 "주말 김장하기" → 민수로 **시간 바꾸기** → 엄마·아빠 응답이 *재확인 필요*로 바뀜 → **확정하기**

## 화면 구성

| 화면 | 파일 | 내용 |
| --- | --- | --- |
| 가족 소식 | `ui/feed/FeedScreen.kt` | 사진·글 피드. 연결된 부탁/일정은 최신 상태를 함께 표시 |
| 오늘 함께할 일 | `ui/together/TogetherScreen.kt` | 오늘 · 응답 대기 · 진행 중 · 전체 |
| 우리 가족 | `ui/family/FamilyScreen.kt` | 초대, 구성원(사용자 전환), 하지 않는 것 |
| 소식 올리기 | `ui/post/ComposePostScreen.kt` | 기본은 일상 게시. 원할 때만 일정/부탁으로 이어감 |
| 소식 상세 | `ui/post/PostDetailScreen.kt` | 읽음(의사 표현과 별개), 댓글, 글쓴이만 연결 버튼 |
| 부탁 등록/상세 | `ui/request/` | 담당 없음 → 제가 챙길게요 → 진행 → 완료/취소, 맡기 취소, 내용 변경 알림 |
| 일정 제안/상세 | `ui/schedule/` | 가능해요 · 시간 바꿔요 · 이번엔 어려워요, 시간 변경 시 재확인 |
| 알림 | `ui/notifications/` | 응답을 요청받은 사람·맡은 사람에게만 알림 |

## 코드 구조

```
app/src/main/java/com/ourhome/today/
├─ data/
│  ├─ model/Models.kt              도메인 모델 (Post, FamilyRequest, SchedulePlan …)
│  ├─ FamilyRepository.kt          저장소 인터페이스 ← 서버 붙일 때 새 구현만 추가
│  ├─ InMemoryFamilyRepository.kt  비즈니스 규칙 (권한, 상태 전이, 알림 대상)
│  ├─ Together.kt                  '오늘 함께할 일' 필터
│  └─ SampleData.kt                시연용 데이터
├─ ui/  (화면들, AppViewModel, OurHomeApp = 내비게이션)
└─ MainActivity.kt
```

기획서의 규칙은 `InMemoryFamilyRepository`에 모여 있고 `app/src/test`의 단위 테스트로 확인합니다.

```bash
./gradlew testDebugUnitTest
```

## 다음 단계 (제안)

1. **서버 연동**: 로그인, 가족 그룹, 사진 업로드(스토리지), 실시간 동기화 — Firebase 또는 Supabase로 `FamilyRepository` 구현 추가. 중복 수락 방지는 서버 트랜잭션으로 보장
2. **푸시 알림**(FCM), **공유 링크/딥링크**로 앱을 잘 안 여는 가족도 항목을 열어 응답
3. 이후: 구매 부탁의 제휴 판매처 링크, 선택형 인화·포토북
4. 초기에서 제외: 상시 위치 추적, 자동 안부 판정, 자체 커머스, 일상 업로드 의무화
