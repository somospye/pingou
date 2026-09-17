import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const projectHighlights = pgTable("project_highlights", {
	threadId: varchar("thread_id", { length: 64 }).primaryKey(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
