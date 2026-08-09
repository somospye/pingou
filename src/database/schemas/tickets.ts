import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const tickets = pgTable("tickets", {
	id: serial("id").primaryKey(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	threadId: varchar("thread_id", { length: 64 }).notNull().unique(),
	subject: varchar("subject", { length: 255 }).notNull(),
	status: varchar("status", { length: 16 }).default("open").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	closedAt: timestamp("closed_at"),
	closedBy: varchar("closed_by", { length: 64 }),
});
