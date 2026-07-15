import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const pendingPostMoves = pgTable("pending_post_moves", {
	threadId: varchar("thread_id", { length: 64 }).primaryKey().notNull(),
	targetForumId: varchar("target_forum_id", { length: 64 }).notNull(),
	reason: varchar("reason", { length: 512 }).notNull(),
	initiatorId: varchar("initiator_id", { length: 64 }).notNull(),
	voterIds: text("voter_ids").array().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
