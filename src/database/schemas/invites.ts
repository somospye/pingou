import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const invites = pgTable("invites", {
	code: varchar("code", { length: 32 }).primaryKey(),
	inviterId: varchar("inviter_id", { length: 64 }).notNull(),
	guildId: varchar("guild_id", { length: 64 }).notNull(),
	uses: integer("uses").default(0).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
