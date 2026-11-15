import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import {
	buildThreadNotice,
	type ThreadNoticeKind,
} from "@/utils/threadNotices";

const NOTICE_CHANNELS: Record<
	string,
	{ kind: ThreadNoticeKind; suffix: string }
> = {
	[CONFIG.CHANNELS.JOBS_OFFERS]: { kind: "job", suffix: "Empleo" },
	[CONFIG.CHANNELS.SERVICES_OFFERS]: { kind: "service", suffix: "Servicio" },
};

/**
 * Crea un thread automáticamente para mensajes en canales configurados.
 * En ofertas de empleo y servicios publica el aviso anti-estafas con
 * botones; en el resto solo menciona al autor. Devuelve true si el canal
 * era de auto-thread (con o sin éxito), para cortar la cadena y no procesar
 * el mensaje como mención IA o thanks.
 */
export async function handleAutoThread(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	const autoChannels = CONFIG.AUTO_THREAD_CHANNELS.filter(Boolean);
	if (!autoChannels.includes(message.channelId)) return false;

	const notice = NOTICE_CHANNELS[message.channelId];

	try {
		// Sin el intent de Message Content el texto llega vacío; por eso los
		// canales con aviso usan siempre el nombre del autor.
		const raw = notice
			? `${message.author.username} - ${notice.suffix}`
			: message.content?.trim() || message.author.username;
		const thread = await client.messages.thread(message.channelId, message.id, {
			name: raw.slice(0, 100),
			auto_archive_duration: 1440,
		});

		if (notice) {
			const guild = message.guildId
				? await client.guilds.fetch(message.guildId).catch(() => null)
				: null;
			await client.messages.write(
				thread.id,
				buildThreadNotice({
					kind: notice.kind,
					authorId: message.author.id,
					channelId: message.channelId,
					messageId: message.id,
					iconUrl: guild?.iconURL() ?? client.me.avatarURL(),
				}),
			);
		} else {
			await client.messages.write(thread.id, {
				content: `<@${message.author.id}>`,
				allowed_mentions: { users: [message.author.id] },
			});
		}
	} catch (err) {
		console.error("Failed to create auto-thread:", err);
	}

	return true;
}
