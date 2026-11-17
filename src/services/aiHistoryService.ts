import { CONFIG } from "@/config";
import { aiHistoryRepository } from "@/repositories/aiHistoryRepository";
import type { ChatTurn } from "@/services/ai";

const MAX_STORED_CHARS = 2_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function since(): Date {
	return new Date(Date.now() - CONFIG.AI.HISTORY.MAX_AGE_DAYS * DAY_MS);
}

/**
 * Historial de conversación de cada usuario con Pingou. Solo guarda las
 * preguntas que mencionan al bot y sus respuestas, recortadas, por
 * CONFIG.AI.HISTORY.MAX_AGE_DAYS días.
 */
export class AiHistoryService {
	async getContext(userId: string): Promise<ChatTurn[]> {
		const rows = await aiHistoryRepository.findRecent(
			userId,
			since(),
			CONFIG.AI.HISTORY.MAX_MESSAGES,
		);
		return rows.map((r) => ({ role: r.role, content: r.content }));
	}

	async record(userId: string, question: string, answer: string) {
		await aiHistoryRepository.add([
			{ userId, role: "user", content: question.slice(0, MAX_STORED_CHARS) },
			{ userId, role: "assistant", content: answer.slice(0, MAX_STORED_CHARS) },
		]);
	}

	/** Borra todo el historial del usuario. Devuelve cuántos mensajes borró. */
	async forget(userId: string): Promise<number> {
		const deleted = await aiHistoryRepository.deleteByUser(userId);
		return deleted.length;
	}

	async cleanup() {
		await aiHistoryRepository.deleteOlderThan(since());
	}
}

export const aiHistoryService = new AiHistoryService();
