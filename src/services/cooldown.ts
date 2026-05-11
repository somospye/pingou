import { cooldownRepository } from "@/repositories/cooldownRepository";

export class CooldownService {
	async setCooldown(userId: string, key: string, seconds: number) {
		const expiresAt = new Date(Date.now() + seconds * 1000);
		const id = `${userId}:${key}`;
		await cooldownRepository.upsert(id, userId, key, expiresAt);
	}

	async getCooldown(userId: string, key: string) {
		const id = `${userId}:${key}`;
		const cooldown = await cooldownRepository.findById(id);

		if (!cooldown || cooldown.expiresAt < new Date()) {
			await this.deleteCooldown(userId, key);
			return null;
		}

		return cooldown;
	}

	async deleteCooldown(userId: string, key: string) {
		const id = `${userId}:${key}`;
		await cooldownRepository.deleteById(id);
	}

	async cleanup() {
		await cooldownRepository.deleteExpired(new Date());
	}

	/**
	 * Rate limit estilo "N usos por ventana de Y segundos" usando slots
	 * derivados de la key (`<key>:0`, `<key>:1`, ...). Cada slot ocupado
	 * vive `windowSeconds`; cuando se liberan se reciclan automáticamente.
	 *
	 * Devuelve `{ ok: true }` si pudo reservar un slot, o
	 * `{ ok: false, retryAfter }` con los segundos hasta que se libere
	 * el slot más próximo.
	 *
	 * NOTA: hay una race condition acotada entre el read y el write — dos
	 * requests concurrentes del mismo usuario podrían ambos reclamar el mismo
	 * slot. En práctica el límite es bajo (Discord API + tiempo humano entre
	 * mentions), pero si esto se vuelve crítico habría que mover a un upsert
	 * atómico con check de conflicto.
	 */
	async claimRateLimitSlot(
		userId: string,
		key: string,
		maxSlots: number,
		windowSeconds: number,
	): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
		// Lectura paralela de todos los slots — N round-trips bajan a 1
		const slots = await Promise.all(
			Array.from({ length: maxSlots }, (_, i) =>
				this.getCooldown(userId, `${key}:${i}`),
			),
		);

		const freeIndex = slots.findIndex((s) => !s);
		if (freeIndex !== -1) {
			await this.setCooldown(userId, `${key}:${freeIndex}`, windowSeconds);
			return { ok: true };
		}

		// Si llegamos acá todos los slots están ocupados (findIndex devolvió -1),
		// así que ningún elemento de slots es null. Filtramos por type-narrowing
		// para no usar optional chaining engañoso en `.expiresAt.getTime()`.
		const occupiedSlots = slots.filter(
			(s): s is NonNullable<typeof s> => s !== null,
		);
		const earliestExpiry = Math.min(
			...occupiedSlots.map((s) => s.expiresAt.getTime()),
		);
		const retryAfter = Math.ceil((earliestExpiry - Date.now()) / 1000);
		return { ok: false, retryAfter: Math.max(retryAfter, 1) };
	}
}

export const cooldownService = new CooldownService();
