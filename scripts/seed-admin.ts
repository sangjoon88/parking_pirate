/**
 * 최초 관리자 생성
 * 사용법: npm run seed:admin -- <닉네임> <비밀번호>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function main() {
  const [nickname, password] = process.argv.slice(2);
  if (!nickname || !password || password.length < 6) {
    console.error("사용법: npm run seed:admin -- <닉네임> <비밀번호(6자 이상)>");
    process.exit(1);
  }
  const { db } = await import("../db");
  const { users } = await import("../db/schema");

  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (admin) {
    console.error(`이미 관리자(${admin.nickname})가 있어요. 중단합니다.`);
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ nickname, passwordHash, role: "admin", referrerId: null })
    .returning({ id: users.id });
  console.log(`관리자 생성 완료: ${nickname} (${created.id})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
