import { createEvent } from "seyfert";
import { handleForumWelcome } from "./forumWelcome";
import { handleProjectAnnounce } from "./projectAnnounce";

const processedThreads = new Set<string>();

/**
 * Único handler de `threadCreate` (ver `messageCreate/index.ts` para el
 * porqué). Delegamos a sub-handlers mutuamente excluyentes:
 *
 * - projectAnnounce: posts en 🔗┊proyectos → aviso en chat-programadores
 * - forumWelcome: foros de ayuda → bienvenida con IA y aviso de duda
 */
export default createEvent({
	data: { once: false, name: "threadCreate" },
	async run(thread, client) {
		if (processedThreads.has(thread.id)) return;
		processedThreads.add(thread.id);

		setTimeout(() => processedThreads.delete(thread.id), 10000);

		if (!(thread as { newlyCreated?: true }).newlyCreated) return;

		if (await handleProjectAnnounce(thread, client)) return;
		await handleForumWelcome(thread, client);
	},
});
