import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const inviteJoins = pgTable("invite_joins", {
	id: serial("id").primaryKey(),
	inviteCode: varchar("invite_code", { length: 32 }).notNull(),
	inviterId: varchar("inviter_id", { length: 64 }),
	userId: varchar("user_id", { length: 64 }).notNull(),
	guildId: varchar("guild_id", { length: 64 }).notNull(),
	joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
