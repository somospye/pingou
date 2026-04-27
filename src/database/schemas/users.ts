import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	userId: varchar("user_id", { length: 64 }).primaryKey().notNull(),
	rep: integer("rep").default(0).notNull(),
	repEmpleos: integer("rep_empleos").default(0).notNull(),
});
