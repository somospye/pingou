import { projectHighlightRepository } from "@/repositories/projectHighlightRepository";

export class ProjectService {
	/**
	 * Reserva el destacado de un proyecto de forma atómica: dos reacciones ⭐
	 * que lleguen a la vez no pueden publicar dos copias, y el registro
	 * sobrevive reinicios del bot.
	 */
	async claimHighlight(threadId: string): Promise<boolean> {
		return await projectHighlightRepository.claim(threadId);
	}

	/** Libera la reserva si no se pudo publicar la copia en destacados. */
	async releaseHighlight(threadId: string): Promise<void> {
		await projectHighlightRepository.release(threadId);
	}
}

export const projectService = new ProjectService();
