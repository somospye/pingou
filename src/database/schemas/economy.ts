import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const economy = pgTable("economy", {
	userId: varchar("user_id", { length: 64 }).primaryKey().notNull(),
	coins: integer("coins").default(0).notNull(),
	lastDaily: timestamp("last_daily"),
	lastWork: timestamp("last_work"),
	lastRob: timestamp("last_rob"),
});
