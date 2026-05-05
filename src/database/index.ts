import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config";

const pool = new Pool({
	connectionString: env.POSTGRES_URL,
});

export const db = drizzle(pool);

pool.query(`SELECT 1`).catch((err) => {
	console.error("Error connecting to database:", err);
	process.exit(1);
});
