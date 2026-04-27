import { eq, like } from "drizzle-orm";
import { db } from "../database";
import { pendingRep } from "../database/schemas/pendingRep";

export class PendingRepRepository {
	async create(data: {
		id: string;
		giverId: string;
		receiverId: string;
		originalMessageId: string;
		originalChannelId: string;
	}) {
		return await db.insert(pendingRep).values(data);
	}

	async findById(id: string) {
		const results = await db
			.select()
			.from(pendingRep)
			.where(eq(pendingRep.id, id))
			.limit(1);
		return results[0];
	}

	async findByMessageId(notifMsgId: string) {
		return await db
			.select()
			.from(pendingRep)
			.where(like(pendingRep.id, `${notifMsgId}-%`));
	}

	async deleteById(id: string) {
		return await db.delete(pendingRep).where(eq(pendingRep.id, id));
	}

	async deleteByMessageId(notifMsgId: string) {
		return await db
			.delete(pendingRep)
			.where(like(pendingRep.id, `${notifMsgId}-%`));
	}
}

export const pendingRepRepository = new PendingRepRepository();
