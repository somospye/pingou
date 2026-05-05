import {
	Command,
	type CommandContext,
	createUserOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { inviteRepository } from "@/repositories/inviteRepository";
import { Embeds } from "@/utils/embeds";

const options = {
	usuario: createUserOption({
		description: "El usuario a consultar",
		required: true,
	}),
};

@Declare({
	name: "invites",
	description: "Ver las invitaciones de un usuario",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class InvitesCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId) return;

		await ctx.deferReply(true);

		const [dbInvites, joins] = await Promise.all([
			inviteRepository.findInvitesByInviterAndGuild(usuario.id, guildId),
			inviteRepository.findJoinsByInviterAndGuild(usuario.id, guildId),
		]);

		await ctx.editOrReply({
			embeds: [
				Embeds.invitesEmbed({
					user: usuario,
					dbInvites,
					joins,
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
