import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { pendingPostMoveRepository } from "@/repositories/pendingPostMoveRepository";
import { Embeds } from "@/utils/embeds";

export interface ExecuteMoveI {
	threadId: string;
	threadName: string;
	sourceForumId: string;
	targetForumId: string;
	reason: string;
	movedById: string;
}

export class MovePostService {
	async getPending(threadId: string) {
		return await pendingPostMoveRepository.findByThreadId(threadId);
	}

	async createPending(data: {
		threadId: string;
		targetForumId: string;
		reason: string;
		initiatorId: string;
	}) {
		return await pendingPostMoveRepository.create(data);
	}

	async addVote(threadId: string, voterId: string) {
		return await pendingPostMoveRepository.addVoter(threadId, voterId);
	}

	async deletePending(threadId: string) {
		return await pendingPostMoveRepository.deleteByThreadId(threadId);
	}

	async cleanupExpired() {
		const cutoff = new Date(
			Date.now() - CONFIG.POST_MOVE.EXPIRY_HOURS * 60 * 60 * 1000,
		);
		return await pendingPostMoveRepository.deleteOlderThan(cutoff);
	}

	// Discord no permite mover hilos entre foros: recreamos el post en el
	// foro destino (las respuestas no se migran) y borramos el original.
	async executeMove(client: UsingClient, data: ExecuteMoveI) {
		// El mensaje inicial de un post de foro comparte id con el hilo
		const starter = await client.messages
			.fetch(data.threadId, data.threadId)
			.catch(() => null);

		let content =
			starter?.content ||
			"*No se pudo recuperar el contenido original del post.*";
		const attachmentUrls = starter?.attachments.map((a) => a.url) ?? [];
		if (attachmentUrls.length) {
			content += `\n${attachmentUrls.join("\n")}`;
		}

		const newThread = await client.channels.thread(
			data.targetForumId,
			{
				name: data.threadName,
				message: {
					content: content.slice(0, 2000),
					embeds: [
						Embeds.postMovedEmbed({
							sourceForumId: data.sourceForumId,
							movedById: data.movedById,
							reason: data.reason,
						}),
					],
				},
			},
			"Post moved from another forum",
		);

		await client.channels
			.delete(data.threadId, {
				reason: `Post moved to forum ${data.targetForumId}`,
			})
			.catch((err) => console.error("Failed to delete original post:", err));

		await pendingPostMoveRepository.deleteByThreadId(data.threadId);

		return newThread;
	}
}

export const movePostService = new MovePostService();
