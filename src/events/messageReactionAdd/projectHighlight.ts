import { ActionRow, Button, type UsingClient } from "seyfert";
import type { ObjectToLower } from "seyfert/lib/common";
import {
	ButtonStyle,
	type GatewayMessageReactionAddDispatchData,
} from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { projectService } from "@/services/projectService";
import { Embeds, firstImageUrl } from "@/utils/embeds";

/**
 * Destacados de 🔗┊proyectos: cuando la publicación inicial de un proyecto
 * junta CONFIG.PROJECTS.HIGHLIGHT_STARS reacciones ⭐ (sin contar la que
 * siembra el bot), publica una copia en ⭐┊destacados. Se hace una sola
 * vez por proyecto.
 */
export async function handleProjectHighlight(
	reaction: ObjectToLower<GatewayMessageReactionAddDispatchData>,
	client: UsingClient,
): Promise<void> {
	if (reaction.emoji.name !== CONFIG.EMOJIS.STAR) return;

	// En un foro, el mensaje inicial comparte ID con el hilo
	if (reaction.messageId !== reaction.channelId) return;

	const thread = await client.channels
		.fetch(reaction.channelId)
		.catch(() => null);
	if (!thread?.isThread() || thread.parentId !== CONFIG.CHANNELS.PROJECTS) {
		return;
	}

	const starter = await client.messages
		.fetch(reaction.messageId, reaction.channelId, true)
		.catch((err) => {
			console.error("Failed to fetch project starter message:", err);
			return null;
		});
	if (!starter) return;

	const star = starter.reactions?.find(
		(r) => r.emoji.name === CONFIG.EMOJIS.STAR,
	);
	const stars = (star?.count ?? 0) - (star?.me ? 1 : 0);
	if (stars < CONFIG.PROJECTS.HIGHLIGHT_STARS) return;

	if (!(await projectService.claimHighlight(thread.id))) return;

	const link = new ActionRow<Button>().addComponents(
		new Button()
			.setStyle(ButtonStyle.Link)
			.setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${thread.id}`)
			.setLabel("Ver publicación original"),
	);

	const highlight = await client.channels
		.thread(CONFIG.CHANNELS.HIGHLIGHTS, {
			name: thread.name,
			applied_tags: [CONFIG.PROJECTS.HIGHLIGHT_TAG],
			message: {
				embeds: [
					Embeds.projectHighlightEmbed({
						ownerId: starter.author.id,
						content: starter.content,
						stars,
						imageUrl: firstImageUrl(starter),
					}),
				],
				components: [link],
			},
		})
		.catch((err) => {
			console.error("Failed to post project highlight:", err);
			return null;
		});

	if (!highlight) {
		await projectService.releaseHighlight(thread.id);
		return;
	}

	await client.messages
		.write(thread.id, {
			content: `🌟 Este proyecto alcanzó ${stars} estrellas y ahora está en <#${CONFIG.CHANNELS.HIGHLIGHTS}>.`,
		})
		.catch((err) => console.error("Failed to notify project author:", err));
}
