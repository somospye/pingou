import {
	Command,
	type CommandContext,
	createIntegerOption,
	createUserOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { reputationService } from "@/services/reputationService";
import { Embeds } from "@/utils/embeds";
import { cleanString } from "@/utils/string";

const options = {
	usuario: createUserOption({
		description: "Usuario al que quitar reputación",
		required: true,
	}),
	cantidad: createIntegerOption({
		description: "Cantidad de puntos a quitar (por defecto 1)",
		required: false,
		min_value: 1,
		max_value: 100,
	}),
};

@Declare({
	name: "remove-rep",
	description: "Quita puntos de reputación a un usuario",
	props: {
		requiredRoles: [
			CONFIG.ROLES.ADMIN,
			CONFIG.ROLES.MODERATOR,
			CONFIG.ROLES.HELPER,
		],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class RemoveRepCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario: user, cantidad: amountRaw = 1 } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId || !ctx.member) return;

		if (user.bot) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "No podés quitarle rep a un bot.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		const userRoles = ctx.member.roles.keys ?? [];
		const isAdmin =
			CONFIG.ROLES.ADMIN && userRoles.includes(CONFIG.ROLES.ADMIN);
		const amount = isAdmin ? amountRaw : 1;

		if (!isAdmin && amountRaw > 1) {
			await ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Sin permiso",
						"Solo los admins pueden quitar más de 1 punto a la vez.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const { points, removedRoles } =
			await reputationService.removeRepAndCheckRoles(ctx.client, {
				guildId,
				receiverId: user.id,
				giverId: ctx.author.id,
				amount,
				reason: "manual",
			});

		if (removedRoles.length) {
			const roleNames = await Promise.all(
				removedRoles.map((roleId) =>
					ctx.client.roles
						.fetch(guildId, roleId)
						.then((r) => r?.name ?? roleId)
						.catch(() => roleId),
				),
			);

			await ctx.client.messages.write(ctx.channelId, {
				embeds: [
					Embeds.repRoleDownEmbed({
						userId: user.id,
						roleNames,
						points,
					}),
				],
			});
		}

		await reputationService
			.sendLogRep(ctx.client, {
				giverId: ctx.author.id,
				giverName: ctx.author.name,
				newRoles: [],
				points,
				receiverId: user.id,
				receiverName: user.name,
			})
			.catch(console.error);

		const singular = amount === 1;

		await ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Reputación removida",
					cleanString`Se quit${singular ? "ó" : "aron"} **${amount}** punto${singular ? "" : "s"}* de reputación a <@${user.id}>.
                    Puntos actuales: **${points}**
                    ${removedRoles.length > 0 ? `Rol removido: ${removedRoles.map((r) => `<@&${r}>`).join(", ")}` : ""}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
