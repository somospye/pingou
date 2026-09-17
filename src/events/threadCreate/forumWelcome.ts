import {
	ActionRow,
	Button,
	type ThreadChannel,
	type UsingClient,
} from "seyfert";
import { CONFIG } from "@/config";
import { aiService } from "@/services/ai";
import { Embeds } from "@/utils/embeds";

export async function handleForumWelcome(
	thread: ThreadChannel,
	client: UsingClient,
): Promise<void> {
	const forum = await client.channels.fetch(thread.parentId);

	if (!forum || !("parentId" in forum)) return;

	if (forum.parentId !== CONFIG.CATEGORIES.FORUMS) return;

	const questionValue = aiService.classify(thread.name);

	let embedDescription: string;

	if (questionValue === "BUENA") {
		embedDescription = `Hola <@${thread.ownerId}>, ¿Quieres que te ayude con tu consulta sobre **${thread.name}**?`;
	} else {
		embedDescription = `Hola <@${thread.ownerId}>, te pido por favor que especifiques mejor tu pregunta sobre **${thread.name}** para poder ayudarte mejor.`;
	}

	const embed = Embeds.threadWelcomeEmbed({
		description: embedDescription,
		botIcon: client.me.avatarURL(),
	});

	const button = new Button()
		.setCustomId("foro-respuesta-ia")
		.setLabel("Responder con IA")
		.setStyle(1)
		.setEmoji("🤖");

	const row = new ActionRow<Button>().addComponents(button);

	await client.messages.write(thread.id, {
		embeds: [embed],
		components: [row],
	});

	const programadoresChannelId = CONFIG.CHANNELS.CHAT_PROGRAMADORES;
	if (programadoresChannelId) {
		const forumChannelName = forum.name || "foro";

		const forumEmbed = Embeds.forumThreadEmbed({
			title: thread.name,
			threadId: thread.id,
			ownerId: thread.ownerId!,
			guildId: thread.guildId!,
			forumName: forumChannelName,
		});

		await client.messages
			.write(programadoresChannelId, {
				embeds: [forumEmbed],
			})
			.catch(console.error);
	}
}
