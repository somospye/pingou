import { eq, like, lt } from "drizzle-orm";
import { db } from "@/database";
import { cooldowns } from "@/database/schemas/cooldowns";

export class CooldownRepository {
	async upsert(id: string, userId: string, key: string, expiresAt: Date) {
		return await db
			.insert(cooldowns)
			.values({
				id,
				userId,
				key,
				expiresAt,
			})
			.onConflictDoUpdate({
				target: cooldowns.id,
				set: { expiresAt },
			});
	}

	async findById(id: string) {
		const result = await db
			.select()
			.from(cooldowns)
			.where(eq(cooldowns.id, id))
			.limit(1);
		return result[0];
	}

	async deleteById(id: string) {
		return await db.delete(cooldowns).where(eq(cooldowns.id, id));
	}

	async findByKeyPrefix(prefix: string) {
		return await db
			.select()
			.from(cooldowns)
			.where(like(cooldowns.key, `${prefix}%`));
	}

	async deleteExpired(date: Date) {
		return await db.delete(cooldowns).where(lt(cooldowns.expiresAt, date));
	}
}

export const cooldownRepository = new CooldownRepository();
