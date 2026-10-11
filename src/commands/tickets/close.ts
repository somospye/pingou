import {
	type CommandContext,
	createStringOption,
	Declare,
	Options,
	SubCommand,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { ticketService } from "@/services/ticketService";
import { Embeds } from "@/utils/embeds";

const options = {
	motivo: createStringOption({
		description: "Motivo del cierre",
		required: false,
		max_length: 500,
	}),
};

const STAFF_ROLES = [
	CONFIG.ROLES.ADMIN,
	CONFIG.ROLES.MODERATOR,
	CONFIG.ROLES.HELPER,
];

@Declare({
	name: "close",
	description: "Cierra el ticket actual",
})
@Options(options)
export class TicketCloseCommand extends SubCommand {
	override async run(ctx: CommandContext<typeof options>) {
		const threadId = ctx.channelId;
		if (!threadId) return;

		const ticket = await ticketService.getOpenTicketByThread(threadId);
		if (!ticket) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						"Este comando solo puede usarse dentro de un ticket abierto.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const userRoles = ctx.member?.roles.keys ?? [];
		const isStaff = STAFF_ROLES.some((roleId) => userRoles.includes(roleId));
		if (ticket.userId !== ctx.author.id && !isStaff) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						"Solo quien abrió el ticket o el staff pueden cerrarlo.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ticketService.closeTicket(threadId, ctx.author.id);

		await ctx.write({
			embeds: [
				Embeds.ticketClosedEmbed({
					closedBy: ctx.author.id,
					reason: ctx.options.motivo,
				}),
			],
		});

		await ctx.client.channels
			.edit(threadId, { locked: true, archived: true })
			.catch((err) => console.error("Failed to lock ticket thread:", err));
	}
}
