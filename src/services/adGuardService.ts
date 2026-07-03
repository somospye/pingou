import { createHash } from "node:crypto";
import { CONFIG } from "@/config";
import { adPostRepository } from "@/repositories/adPostRepository";

const WINDOW_MS = CONFIG.AD_GUARD.WINDOW_DAYS * 24 * 60 * 60 * 1000;

export class AdGuardService {
	/**
	 * Normaliza el contenido para compararlo entre publicaciones: minúsculas,
	 * sin URLs, menciones, emojis custom ni puntuación, con espacios
	 * colapsados. Así dos avisos "iguales" con links o formato distinto
	 * producen el mismo texto comparable.
	 */
	normalize(content: string): string {
		return content
			.toLowerCase()
			.replace(/https?:\/\/\S+/g, " ")
			.replace(/<a?:\w+:\d+>/g, " ")
			.replace(/<(?:@[!&]?|#)\d+>/g, " ")
			.replace(/[^\p{L}\p{N}\s]/gu, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	private hash(normalized: string): string {
		return createHash("sha256").update(normalized).digest("hex");
	}

	private jaccardSimilarity(a: string, b: string): number {
		const tokensA = new Set(a.split(" "));
		const tokensB = new Set(b.split(" "));
		if (!tokensA.size || !tokensB.size) return 0;

		let intersection = 0;
		for (const token of tokensA) {
			if (tokensB.has(token)) intersection++;
		}
		const union = tokensA.size + tokensB.size - intersection;
		return intersection / union;
	}

	/**
	 * Busca publicaciones del usuario en el canal dentro de la ventana que
	 * sean iguales (mismo hash) o muy similares (Jaccard sobre tokens >=
	 * threshold). Devuelve el registro matcheado — su `createdAt` permite
	 * avisarle al usuario cuándo puede volver a publicar — o null.
	 */
	async checkRepost(userId: string, channelId: string, content: string) {
		const normalized = this.normalize(content);
		if (!normalized) return null;

		const contentHash = this.hash(normalized);
		const since = new Date(Date.now() - WINDOW_MS);
		const recent = await adPostRepository.findRecentByUserAndChannel(
			userId,
			channelId,
			since,
		);

		return (
			recent.find(
				(post) =>
					post.contentHash === contentHash ||
					this.jaccardSimilarity(normalized, post.normalizedContent) >=
						CONFIG.AD_GUARD.SIMILARITY_THRESHOLD,
			) ?? null
		);
	}

	async recordPost(userId: string, channelId: string, content: string) {
		const normalized = this.normalize(content);
		if (!normalized) return;

		await adPostRepository.create({
			userId,
			channelId,
			contentHash: this.hash(normalized),
			normalizedContent: normalized,
		});
	}

	repostExpiresAt(postCreatedAt: Date): Date {
		return new Date(postCreatedAt.getTime() + WINDOW_MS);
	}

	async cleanup() {
		await adPostRepository.deleteOlderThan(new Date(Date.now() - WINDOW_MS));
	}
}

export const adGuardService = new AdGuardService();
