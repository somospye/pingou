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
}

export const cooldownService = new CooldownService();
