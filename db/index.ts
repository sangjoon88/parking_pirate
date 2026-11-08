import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// neon-serverless(WebSocket) 드라이버: 가입처럼 트랜잭션이 필요한 작업을 지원한다.
// Node 22 이상은 전역 WebSocket이 있어서 별도 설정이 필요 없다.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export { schema };
