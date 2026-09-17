import type { ThreadChannel, UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { Embeds, firstImageUrl } from "@/utils/embeds";

/**
 * Difusión de 🔗┊proyectos: cuando alguien publica un proyecto, el bot
 * siembra la reacción ⭐ en la publicación y avisa en chat-programadores
 * con el enlace y un resumen. Devuelve true si el hilo era del foro de
 * proyectos, para cortar la cadena.
 */
export async function handleProjectAnnounce(
	thread: ThreadChannel,
	client: UsingClient,
): Promise<boolean> {
	if (thread.parentId !== CONFIG.CHANNELS.PROJECTS) return false;

	// En un foro, el mensaje inicial comparte ID con el hilo
	const starter = await client.messages
		.fetch(thread.id, thread.id)
		.catch((err) => {
			console.error("Failed to fetch project starter message:", err);
			return null;
		});

	await client.reactions
		.add(thread.id, thread.id, CONFIG.EMOJIS.STAR)
		.catch((err) => console.error("Failed to seed star on project:", err));

	const ownerId = thread.ownerId ?? starter?.author.id;
	if (!ownerId) return true;

	await client.messages
		.write(CONFIG.CHANNELS.CHAT_PROGRAMADORES, {
			embeds: [
				Embeds.projectAnnouncementEmbed({
					title: thread.name,
					threadId: thread.id,
					ownerId,
					summary: starter?.content,
					imageUrl: firstImageUrl(starter),
				}),
			],
		})
		.catch((err) => console.error("Failed to announce project:", err));

	return true;
}
