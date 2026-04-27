import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const pendingRep = pgTable("pending_rep", {
	id: varchar("id", { length: 64 }).primaryKey().notNull(),
	giverId: varchar("giver_id", { length: 64 }).notNull(),
	receiverId: varchar("receiver_id", { length: 64 }).notNull(),
	originalMessageId: varchar("original_message_id", { length: 64 }).notNull(),
	originalChannelId: varchar("original_channel_id", { length: 64 }).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
