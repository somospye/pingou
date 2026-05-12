import { ActionRow, Button, type Message, type UsingClient } from "seyfert";
import { ButtonStyle } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { pendingRepRepository } from "@/repositories/pendingRepRepository";
import { Embeds } from "@/utils/embeds";

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function containsThanks(text: string): boolean {
	const normalized = normalizeText(text);
	return CONFIG.OTHER.THANKS_TERMS.some((term) =>
		new RegExp(`\\b${term}\\b`).test(normalized),
	);
}

/**
 * Detecta agradecimientos ("gracias", "thx", etc.) en canales permitidos
 * y publica una notificación de reputación pendiente con botones de
 * aprobar/rechazar para staff. Devuelve true si el mensaje contenía un
 * agradecimiento (incluso si el canal no era válido o no había receptor),
 * para que index.ts no siga procesando.
 */
export async function handleThanks(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	if (!CONFIG.CHANNELS.REP_NOTIFICATION) return false;

	const content = message.content ?? "";
	if (!containsThanks(content)) return false;

	const giverId = message.author.id;
	const guildId = message.guildId;
	if (!guildId) return true;

	// Solo escuchar canales permitidos
	try {
		const channel = (await client.channels.fetch(message.channelId)) as {
			id: string;
			parentId?: string;
		} | null;
		if (!channel) return true;

		const allowed =
			// Canal explícitamente permitido
			channel.id === CONFIG.CHANNELS.CHAT_PROGRAMADORES ||
			// Texto directo bajo la categoría FOROS
			channel.parentId === CONFIG.CATEGORIES.FORUMS ||
			// Thread de un canal foro que está bajo la categoría FOROS
			(channel.parentId
				? await client.channels
						.fetch(channel.parentId)
						.then(
							(p) =>
								(p as { parentId?: string } | null)?.parentId ===
								CONFIG.CATEGORIES.FORUMS,
						)
						.catch(() => false)
				: false);

		if (!allowed) return true;
	} catch {
		return true;
	}

	// 1. Explicit @mentions
	const mentionsArray = Array.isArray(message.mentions.users)
		? message.mentions.users
		: [
				...(
					message.mentions.users as Map<
						string,
						{ id: string; username: string; bot?: boolean }
					>
				).values(),
			];
	const explicitMentions = mentionsArray
		.filter((u: { id: string; bot?: boolean }) => !u.bot && u.id !== giverId)
		.slice(0, 4);

	// 2. Reply target
	const replyAuthor = message.referencedMessage?.author;
	const replyReceiver =
		replyAuthor && !replyAuthor.bot && replyAuthor.id !== giverId
			? replyAuthor
			: null;

	let receiverUsers: Array<{ id: string; username: string }> = [];

	if (explicitMentions.length > 0) {
		receiverUsers = explicitMentions;
	} else if (replyReceiver) {
		receiverUsers = [replyReceiver];
	} else {
		// Busca en los últimos 30 mensajes usuarios que le respondieron al giver
		try {
			const recentMsgs = await client.messages.list(message.channelId, {
				limit: 30,
			});
			const seen = new Set<string>();
			for (const msg of recentMsgs) {
				if (msg.id === message.id) continue;
				if (msg.author.bot || msg.author.id === giverId) continue;
				if (msg.referencedMessage?.author?.id !== giverId) continue;
				if (seen.has(msg.author.id)) continue;
				seen.add(msg.author.id);
				receiverUsers.push(msg.author);
				if (receiverUsers.length >= 4) break;
			}
		} catch {
			return true;
		}
	}

	if (receiverUsers.length === 0) return true;

	const messageUrl = `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;
	const referencedContent = message.referencedMessage?.content ?? null;

	const receivers = receiverUsers.map(
		(u: { id: string; username: string }) => ({
			id: u.id,
			name: u.username,
		}),
	);

	const notifEmbed = Embeds.repNotificationEmbed({
		giverId,
		giverName: message.author.username,
		receivers,
		messageUrl,
		channelId: message.channelId,
		thanksContent: content,
		referencedContent,
	});

	const approveButtons = receivers.map((_r, i) =>
		new Button()
			.setCustomId(`rep-approve-${i}`)
			.setLabel(`${i + 1}`)
			.setStyle(ButtonStyle.Primary),
	);

	const eliminarButton = new Button()
		.setCustomId("rep-reject-all")
		.setLabel("Eliminar")
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRow<Button>().setComponents([
		...approveButtons,
		eliminarButton,
	]);

	const notifMsg = await client.messages.write(
		CONFIG.CHANNELS.REP_NOTIFICATION,
		{ embeds: [notifEmbed], components: [row] },
	);

	await Promise.all(
		receivers.map((r, i) =>
			pendingRepRepository.create({
				id: `${notifMsg.id}-${i}`,
				giverId,
				receiverId: r.id,
				originalMessageId: message.id,
				originalChannelId: message.channelId,
			}),
		),
	);

	return true;
}
