import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const deletedForumPosts = pgTable("deleted_forum_posts", {
	id: serial("id").primaryKey(),
	threadId: varchar("thread_id", { length: 64 }).notNull(),
	forumId: varchar("forum_id", { length: 64 }).notNull(),
	// Nullable: unknown when the starter message author is not cached
	authorId: varchar("author_id", { length: 64 }),
	title: varchar("title", { length: 128 }).notNull(),
	deletedAt: timestamp("deleted_at").defaultNow().notNull(),
});
