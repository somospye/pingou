import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const voiceSessions = pgTable("voice_sessions", {
	userId: varchar("user_id", { length: 64 }).primaryKey().notNull(),
	channelId: varchar("channel_id", { length: 64 }).notNull(),
	joinedAt: timestamp("joined_at").notNull(),
	lastAwardedAt: timestamp("last_awarded_at").notNull(),
});
