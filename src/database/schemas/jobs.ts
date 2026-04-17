import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const pendingJobs = pgTable("pending_jobs", {
	id: varchar("id", { length: 255 }).primaryKey(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description").notNull(),
	requirements: text("requirements").notNull(),
	salary: varchar("salary", { length: 255 }),
	contact: varchar("contact", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
