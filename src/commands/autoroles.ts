import {
	ActionRow,
	Command,
	type CommandContext,
	Declare,
	Middlewares,
	StringSelectMenu,
	StringSelectOption,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { type AutoRoleCategory, CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";

function buildCategoryMenu(category: AutoRoleCategory): StringSelectMenu {
	return new StringSelectMenu()
		.setCustomId(`autoroles:${category.id}`)
		.setPlaceholder("Selecciona tus roles")
		.setValuesLength({ min: 0, max: category.roles.length })
		.setOptions(
			category.roles.map((role) => {
				const option = new StringSelectOption()
					.setLabel(role.label)
					.setValue(role.roleId);
				if (role.description) option.setDescription(role.description);
				if (role.emoji) option.setEmoji(role.emoji);
				return option;
			}),
		);
}

@Declare({
	name: "autoroles",
	description: "Publica los paneles de auto-roles en este canal",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Middlewares(["auth"])
export default class AutoRolesCommand extends Command {
	override async run(ctx: CommandContext) {
		if (!CONFIG.AUTO_ROLES.length) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Auto-roles",
						"No hay categorías de auto-roles configuradas.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.deferReply(true);

		for (const category of CONFIG.AUTO_ROLES) {
			const menuRow = new ActionRow<StringSelectMenu>().setComponents([
				buildCategoryMenu(category),
			]);

			await ctx.client.messages
				.write(ctx.channelId, {
					embeds: [Embeds.autoRoleCategoryEmbed(category)],
					components: [menuRow],
				})
				.catch((err) =>
					console.error(
						`Failed to post auto-roles panel for category ${category.id}:`,
						err,
					),
				);
		}

		await ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Auto-roles",
					"Los paneles de auto-roles se publicaron en este canal.",
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
