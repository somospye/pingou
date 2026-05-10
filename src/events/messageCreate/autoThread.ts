import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";

/**
 * Crea un thread automáticamente para mensajes en canales configurados
 * y postea un ping al autor. Devuelve true si el canal era de auto-thread
 * (con o sin éxito), para cortar la cadena y no procesar el mensaje como
 * mención IA o thanks.
 */
export async function handleAutoThread(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	const autoChannels = CONFIG.AUTO_THREAD_CHANNELS.filter(Boolean);
	if (!autoChannels.includes(message.channelId)) return false;

	try {
		const raw = message.content?.trim() || message.author.username;
		const threadName = raw.slice(0, 100);
		const thread = await client.messages.thread(message.channelId, message.id, {
			name: threadName,
			auto_archive_duration: 1440,
		});
		await client.messages.write(thread.id, {
			content: `<@${message.author.id}>`,
		});
	} catch {}

	return true;
}
