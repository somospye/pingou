import { integer, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";

export const inviteStats = pgTable(
	"invite_stats",
	{
		inviterId: varchar("inviter_id", { length: 64 }).notNull(),
		guildId: varchar("guild_id", { length: 64 }).notNull(),
		totalInvites: integer("total_invites").default(0).notNull(),
		currentMembers: integer("current_members").default(0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.inviterId, table.guildId] })],
);
