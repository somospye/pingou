import { pgTable, serial, unique, varchar } from "drizzle-orm/pg-core";

export const memeReactions = pgTable(
	"meme_reactions",
	{
		id: serial("id").primaryKey(),
		guildId: varchar("guild_id", { length: 64 }).notNull(),
		channelId: varchar("channel_id", { length: 64 }).notNull(),
		emoji: varchar("emoji", { length: 64 }).notNull(),
	},
	(t) => [unique().on(t.guildId, t.channelId, t.emoji)],
);
