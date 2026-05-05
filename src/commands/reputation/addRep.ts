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
		description: "Usuario al que agregar reputación",
		required: true,
	}),
	cantidad: createIntegerOption({
		description: "Cantidad de puntos a agregar (por defecto 1)",
		required: false,
		min_value: 1,
		max_value: 100,
	}),
};

@Declare({
	name: "add-rep",
	description: "Agrega puntos de reputación a un usuario",
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
export default class AddRepCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario: user, cantidad: amountRaw = 1 } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId || !ctx.member) return;

		if (user.bot) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "No podés darle rep a un bot.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (user.id === ctx.author.id) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "No te podés dar rep vos mismo.")],
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
						"Solo los admins pueden dar más de 1 punto a la vez.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const { points, addedRoles } = await reputationService.addRepAndCheckRoles(
			ctx.client,
			{
				guildId,
				receiverId: user.id,
				giverId: ctx.author.id,
				amount,
				reason: "manual",
			},
		);

		if (addedRoles.length) {
			const roleNames = await Promise.all(
				addedRoles.map((roleId) =>
					ctx.client.roles
						.fetch(guildId, roleId)
						.then((r) => r?.name ?? roleId)
						.catch(() => roleId),
				),
			);

			await ctx.client.messages.write(ctx.channelId, {
				embeds: [
					Embeds.repRoleUpEmbed({
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
				newRoles: addedRoles,
				points,
				receiverId: user.id,
				receiverName: user.name,
			})
			.catch(console.error);

		const singular = amount === 1;

		await ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Reputación agregada",
					cleanString`Se agreg${singular ? "ó" : "aron"} **${amount}** punto${singular ? "" : "s"}* de reputación a <@${user.id}>.
                    Puntos actuales: **${points}**
                    ${addedRoles.length > 0 ? `Nuevo rol: ${addedRoles.map((r) => `<@&${r}>`).join(", ")}` : ""}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
