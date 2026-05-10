import type { Message, UsingClient } from "seyfert";
import { aiService } from "@/services/ai";
import { cooldownService } from "@/services/cooldown";
import { Embeds } from "@/utils/embeds";

/**
 * Maneja menciones al bot (@Pingou ...) con respuesta de IA. Si la mención
 * trae contenido se usa como prompt; si vino vacía toma los últimos
 * mensajes del autor en el canal como contexto. Devuelve true si el mensaje
 * mencionaba al bot (incluso si rebotó por cooldown), para cortar la cadena.
 *
 * Cooldown de 15s por usuario en la key "ai-mention".
 */
export async function handleAiMention(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	if (!message.mentions.users.some((u) => u.id === client.me.id)) return false;

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
		await message
			.reply({
				embeds: [
					Embeds.errorEmbed(
						"Calma!",
						`Estás saturando la IA. Espera **${remaining} segundos** por favor.`,
					),
				],
			})
			.catch(() => {});
		return true;
	}

	const cleanContent = (message.content ?? "")
		.replaceAll(new RegExp(`<@!?${client.me.id}>`, "g"), "")
		.trim();

	let promptMessages: string[] = [];

	if (cleanContent.length > 0) {
		promptMessages = [`${message.author.username}: ${cleanContent}`];
	} else {
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

		if (!prevMessages) return true;

		promptMessages = [...prevMessages]
			.reverse()
			.map((m) => `${m.author.username}: ${m.content ?? ""}`);
	}

	try {
		const { text, usage } = await aiService.chat(promptMessages);

		await cooldownService.setCooldown(userId, cooldownKey, 15);

		const embeds = Embeds.aiReplyEmbeds(text, usage);
		for (const embed of embeds) {
			await message.reply({ embeds: [embed] });
		}
	} catch (error) {
		console.error("Error in AI mention reply:", error);
		await message
			.reply({
				embeds: [
					Embeds.errorEmbed(
						"Error de IA",
						"Ocurrió un error al procesar tu pregunta. Por favor, intentá más tarde.",
					),
				],
			})
			.catch(() => {});
	}

	return true;
}
