import { and, eq } from "drizzle-orm";
import { db } from "@/database";
import { tickets } from "@/database/schemas/tickets";

export class TicketRepository {
	async create(data: { userId: string; threadId: string; subject: string }) {
		const results = await db.insert(tickets).values(data).returning();
		return results[0];
	}

	async findOpenByUser(userId: string) {
		const results = await db
			.select()
			.from(tickets)
			.where(and(eq(tickets.userId, userId), eq(tickets.status, "open")))
			.limit(1);
		return results[0];
	}

	async findOpenByThread(threadId: string) {
		const results = await db
			.select()
			.from(tickets)
			.where(and(eq(tickets.threadId, threadId), eq(tickets.status, "open")))
			.limit(1);
		return results[0];
	}

	async close(threadId: string, closedBy: string) {
		return await db
			.update(tickets)
			.set({ status: "closed", closedAt: new Date(), closedBy })
			.where(eq(tickets.threadId, threadId));
	}
}

export const ticketRepository = new TicketRepository();
