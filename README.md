# 주차해적단

차단기 없는 아파트 단지를 회원끼리 공유하는 초대제 지도 웹앱(PWA). 자세한 기획은 [CLAUDE.md](CLAUDE.md).

## 처음 설정

1. `.env.example`을 복사해 `.env.local`을 만들고 값을 채운다.
   - `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. 패키지 설치: `npm install`
3. 테이블 생성: `npm run db:push`
4. 최초 관리자 만들기: `npm run seed:admin -- <닉네임> <비밀번호>`
5. 개발 서버: `npm run dev` → http://localhost:3000

카카오 개발자 콘솔 > 앱 > 플랫폼 > Web 사이트 도메인에 `http://localhost:3000`과 Vercel 도메인을 등록해야 지도가 뜬다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm run db:push` | Drizzle 스키마를 Neon DB에 반영 |
| `npm run db:studio` | DB 브라우저 |
| `npm run seed:admin -- 닉네임 비밀번호` | 최초 관리자 생성 |

## 참고

- Next.js 16에서는 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었다. 로그인 확인은 [proxy.ts](proxy.ts)에서 한다.
- 휴대폰 실기기에서 위치(GPS)는 HTTPS에서만 동작한다. 로컬 테스트는 Vercel 프리뷰 배포로 하는 게 편하다.
