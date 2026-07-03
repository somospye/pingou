import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const adPosts = pgTable("ad_posts", {
	id: serial("id").primaryKey(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	channelId: varchar("channel_id", { length: 64 }).notNull(),
	contentHash: varchar("content_hash", { length: 64 }).notNull(),
	normalizedContent: text("normalized_content").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
