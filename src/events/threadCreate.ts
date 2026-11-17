import {
	Container,
	createEvent,
	Section,
	TextDisplay,
	Thumbnail,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { aiService } from "@/services/ai";
import { Embeds } from "@/utils/embeds";

const processedThreads = new Set<string>();

export default createEvent({
	data: { once: false, name: "threadCreate" },
	async run(thread, client) {
		if (processedThreads.has(thread.id)) return;
		processedThreads.add(thread.id);

		setTimeout(() => processedThreads.delete(thread.id), 10000);

		if (!(thread as { newlyCreated?: true }).newlyCreated) return;

		const forum = await client.channels.fetch(thread.parentId);

		if (!forum || !("parentId" in forum)) return;

		if (forum.parentId !== CONFIG.CATEGORIES.FORUMS) return;

		// Sin el intent de Message Content Pingou no puede leer la descripción
		// del post, así que en vez de responder con IA invita a mencionarlo.
		const isVague = aiService.classify(thread.name) === "VAGA";
		const lines = [
			`## ¡Hola, <@${thread.ownerId}>!`,
			"Alguien de la comunidad te va a ayudar pronto.",
			`-# Mientras tanto, puedes mencionarme (<@${client.me.id}>) con tu duda y te respondo.`,
		];
		if (isVague) {
			lines.push(
				"-# Si puedes, agrega más detalles al post: así es más fácil que te ayuden.",
			);
		}

		const avatar = client.me.avatarURL();
		const text = new TextDisplay().setContent(lines.join("\n"));
		await client.messages.write(thread.id, {
			components: [
				new Container()
					.setColor(0x5865f2)
					.addComponents(
						avatar
							? new Section()
									.addComponents(text)
									.setAccessory(new Thumbnail().setMedia(avatar))
							: text,
					),
			],
			flags: MessageFlags.IsComponentsV2,
			allowed_mentions: { parse: [] },
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
	},
});
