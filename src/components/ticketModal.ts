import { ModalCommand, type ModalContext } from "seyfert";
import { ChannelType } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { ticketService } from "@/services/ticketService";
import { Embeds } from "@/utils/embeds";

export default class TicketModal extends ModalCommand {
	override filter(ctx: ModalContext) {
		return ctx.customId === "ticket:modal";
	}

	override async run(ctx: ModalContext) {
		const subject = ctx.interaction.getInputValue("subject", true) as string;
		const description = ctx.interaction.getInputValue("description", false) as
			| string
			| undefined;

		const channelId = ctx.channelId;
		if (!channelId) return;

		await ctx.deferReply(true);

		const thread = await ctx.client.channels.thread(channelId, {
			name: `ticket-${ctx.author.username}`,
			type: ChannelType.PrivateThread,
			invitable: false,
			auto_archive_duration: 10080,
		});

		const result = await ticketService.openTicket({
			userId: ctx.author.id,
			threadId: thread.id,
			subject,
		});

		if (!result.created) {
			await ctx.client.channels
				.delete(thread.id)
				.catch((err) =>
					console.error("Failed to delete duplicate ticket thread:", err),
				);
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Ya tienes un ticket abierto",
						`Puedes continuar la conversación en <#${result.existing.threadId}>.`,
					),
				],
			});
		}

		// El bot tiene allowedMentions.parse [] global (src/index.ts) — sin este
		// override explícito ni el usuario ni el staff recibirían el ping.
		await ctx.client.messages.write(thread.id, {
			content: `<@${ctx.author.id}> <@&${CONFIG.ROLES.MODERATOR}>`,
			embeds: [
				Embeds.ticketOpenedEmbed({
					userId: ctx.author.id,
					subject,
					description,
				}),
			],
			allowed_mentions: {
				users: [ctx.author.id],
				roles: [CONFIG.ROLES.MODERATOR],
			},
		});

		return ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Ticket creado",
					`Tu ticket fue creado en <#${thread.id}>.`,
				),
			],
		});
	}
}
