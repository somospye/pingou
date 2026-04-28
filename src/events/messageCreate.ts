import { ActionRow, Button, createEvent } from "seyfert";
import { ButtonStyle } from "seyfert/lib/types";
import { CONFIG } from "../config/config";
import { pendingRepRepository } from "../repositories/pendingRepRepository";
import { aiService } from "../services/ai";
import { bumpService } from "../services/bumpService";
import { cooldownService } from "../services/cooldown";
import { Embeds } from "../utils/embeds";

const DISBOARD_ID = "302050872383242240";
const THANKS_TERMS = [
	"gracias",
	"grax",
	"grac",
	"muchas gracias",
	"mil gracias",
	"muchisimas gracias",
	"thanks",
	"thank you",
	"thankyou",
	"thx",
	"ty",
];

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
	return THANKS_TERMS.some((term) =>
		new RegExp(`\\b${term}\\b`).test(normalized),
	);
}

export default createEvent({
	data: { once: false, name: "messageCreate" },
	async run(message, client) {
		if (message.author.id === DISBOARD_ID) {
			await bumpService.handleBump(message);
			return;
		}

		if (message.author.bot) return;

		// AI mention reply
		if (message.mentions.users.some((u) => u.id === client.me.id)) {
			const userId = message.author.id;
			const cooldownKey = "ai-mention";

			const currentCooldown = await cooldownService.getCooldown(
				userId,
				cooldownKey,
			);

			if (currentCooldown) {
				const remaining = Math.ceil(
					(currentCooldown.expiresAt.getTime() - Date.now()) / 1000,
				);
				return message.reply({
					embeds: [
						Embeds.errorEmbed(
							"Calma!",
							`Estás saturando la IA. Espera **${remaining} segundos** por favor.`,
						),
					],
				});
			}

			let contextLimit = 2;
			const content = message.content ?? "";
			const match = /contexto:\s*(\d+)/i.exec(content);
			if (match?.[1]) {
				contextLimit = Math.min(Number.parseInt(match[1], 10), 10);
			}

			const prevMessages = await aiService.getLatestMessages(
				client,
				message.channelId,
				contextLimit + 1,
				message.author.id,
			);

			if (!prevMessages) return;

			const promptMessages = [...prevMessages]
				.reverse()
				.map((m) => `${m.author.username}: ${m.content ?? ""}`);

			const { text, usage } = await aiService.chat(promptMessages);

			await cooldownService.setCooldown(userId, cooldownKey, 15);

			const embeds = Embeds.aiReplyEmbeds(text, usage);
			for (const embed of embeds) {
				await message.reply({ embeds: [embed] });
			}
			return;
		}

		// Thanks detection
		if (!CONFIG.CHANNELS.REP_NOTIFICATION) return;

		const content = message.content ?? "";
		if (!containsThanks(content)) return;

		const giverId = message.author.id;
		const guildId = message.guildId;
		if (!guildId) return;

		// Solo escuchar canales permitidos
		try {
			const channel = (await client.channels.fetch(message.channelId)) as {
				id: string;
				parentId?: string;
			} | null;
			if (!channel) return;

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

			if (!allowed) return;
		} catch {
			return;
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
				return;
			}
		}

		if (receiverUsers.length === 0) return;

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

		const approveButtons = receivers.map((r, i) =>
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
	},
});
