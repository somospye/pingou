import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { adGuardService } from "@/services/adGuardService";
import { Embeds } from "@/utils/embeds";

const NOTICE_DELETE_MS = 15_000;

/**
 * Control de publicidad repetida en canales de autopromoción
 * (CONFIG.AD_GUARD.CHANNELS). Si el mensaje repite una publicación del
 * mismo usuario en el mismo canal dentro de la ventana, lo borra y avisa
 * por DM (o con un aviso efímero en el canal si tiene DMs cerrados) y
 * devuelve true para cortar la cadena — un mensaje borrado no debe generar
 * auto-thread. Si es publicación nueva la registra y devuelve false.
 *
 * Los nombres de los adjuntos entran al texto comparable para que reposts
 * de solo imágenes con el mismo archivo sigan siendo detectables.
 */
export async function handleAdGuard(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	if (!CONFIG.AD_GUARD.CHANNELS.includes(message.channelId)) return false;

	const attachmentNames = message.attachments
		.map((att) => att.filename)
		.join(" ");
	const comparable = `${message.content ?? ""} ${attachmentNames}`.trim();
	if (!comparable) return false;

	const previous = await adGuardService.checkRepost(
		message.author.id,
		message.channelId,
		comparable,
	);

	if (!previous) {
		await adGuardService.recordPost(
			message.author.id,
			message.channelId,
			comparable,
		);
		return false;
	}

	await message
		.delete("Repeated self-promotion within the cooldown window")
		.catch((err) => console.error("Failed to delete repeated ad:", err));

	const retryTimestamp = Math.floor(
		adGuardService.repostExpiresAt(previous.createdAt).getTime() / 1000,
	);

	await client.users
		.createDM(message.author.id)
		.then((dm) =>
			dm.messages.write({
				embeds: [
					Embeds.adRepostDMEmbed({
						channelId: message.channelId,
						windowDays: CONFIG.AD_GUARD.WINDOW_DAYS,
						retryTimestamp,
					}),
				],
			}),
		)
		.catch(() => sendChannelNotice(message, client, retryTimestamp));

	return true;
}

/** Fallback cuando el usuario tiene los DMs cerrados: aviso que se autoborra. */
async function sendChannelNotice(
	message: Message,
	client: UsingClient,
	retryTimestamp: number,
) {
	const notice = await client.messages
		.write(message.channelId, {
			content: `<@${message.author.id}> tu publicación fue eliminada por repetirse en los últimos ${CONFIG.AD_GUARD.WINDOW_DAYS} días. Podrás volver a publicarla <t:${retryTimestamp}:R>.`,
			allowed_mentions: { users: [message.author.id] },
		})
		.catch((err) => {
			console.error("Failed to send ad repost notice:", err);
			return null;
		});

	if (!notice) return;
	setTimeout(() => {
		client.messages.delete(notice.id, message.channelId).catch(() => {});
	}, NOTICE_DELETE_MS);
}
