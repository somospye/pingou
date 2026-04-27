import {
	integer,
	pgTable,
	serial,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const repHistory = pgTable("rep_history", {
	id: serial("id").primaryKey(),
	issuedBy: varchar("issued_by", { length: 64 }).notNull(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	reason: varchar("reason", { length: 255 }).default("ayuda").notNull(),
	points: integer("points").default(1).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
