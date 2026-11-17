import {
	index,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const aiHistoryRoleEnum = pgEnum("ai_history_role", [
	"user",
	"assistant",
]);

// Mensajes de cada usuario con Pingou (solo los que lo mencionan) y las
// respuestas del bot, para darle contexto a la IA. Ver CONFIG.AI.HISTORY.
export const aiHistory = pgTable(
	"ai_history",
	{
		id: serial("id").primaryKey(),
		userId: varchar("user_id", { length: 64 }).notNull(),
		role: aiHistoryRoleEnum("role").notNull(),
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("ai_history_user_idx").on(table.userId, table.createdAt)],
);
