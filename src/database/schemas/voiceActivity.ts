import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const voiceActivity = pgTable("voice_activity", {
	userId: varchar("user_id", { length: 64 }).primaryKey().notNull(),
	points: integer("points").default(0).notNull(),
	totalMinutes: integer("total_minutes").default(0).notNull(),
});
