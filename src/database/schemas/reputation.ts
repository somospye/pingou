import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const reputation = pgTable("reputation", {
	userId: varchar("user_id", { length: 64 }).primaryKey().notNull(),
	points: integer("points").default(0).notNull(),
});
