import {
	Command,
	type CommandContext,
	createStringOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { memeReactionsRepository } from "@/repositories/memeReactionsRepository";
import { Embeds } from "@/utils/embeds";

const options = {
	accion: createStringOption({
		description: "Acción a realizar",
		required: true,
		choices: [
			{ name: "Agregar reacción", value: "agregar" },
			{ name: "Eliminar reacción", value: "eliminar" },
			{ name: "Listar reacciones", value: "listar" },
		] as const,
	}),
	emoji: createStringOption({
		description: "Emoji a agregar o eliminar",
		required: false,
	}),
};

@Declare({
	name: "meme-reacciones",
	description: "Configura las reacciones automáticas del canal de memes",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class MemeReaccionesCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { accion, emoji } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId) return;

		if (!CONFIG.CHANNELS.MEMES) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Canal no configurado",
						"El canal de memes no está configurado en el servidor.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.deferReply(true);

		try {
			if (accion === "listar") {
				return await this.handleListar(ctx, guildId);
			}

			if (!emoji) {
				return ctx.editOrReply({
					embeds: [
						Embeds.errorEmbed(
							"Falta el emoji",
							"Tenés que especificar un emoji para esta acción.",
						),
					],
				});
			}

			if (accion === "agregar") {
				return await this.handleAgregar(ctx, guildId, emoji);
			}

			if (accion === "eliminar") {
				return await this.handleEliminar(ctx, guildId, emoji);
			}
		} catch (error) {
			console.error("Error in meme-reacciones:", error);
			await ctx
				.editOrReply({
					embeds: [
						Embeds.errorEmbed(
							"Error",
							"Ocurrió un error al procesar la acción.",
						),
					],
				})
				.catch(console.error);
		}
	}

	private async handleAgregar(
		ctx: CommandContext<typeof options>,
		guildId: string,
		emoji: string,
	) {
		const result = await memeReactionsRepository.add(
			guildId,
			CONFIG.CHANNELS.MEMES,
			emoji,
		);
		if (result.length === 0) {
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Ya existe",
						`${emoji} ya es una reacción automática en <#${CONFIG.CHANNELS.MEMES}>.`,
					),
				],
			});
		}
		return ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Reacción agregada",
					`Se agregó ${emoji} como reacción automática en <#${CONFIG.CHANNELS.MEMES}>.`,
				),
			],
		});
	}

	private async handleEliminar(
		ctx: CommandContext<typeof options>,
		guildId: string,
		emoji: string,
	) {
		const result = await memeReactionsRepository.remove(
			guildId,
			CONFIG.CHANNELS.MEMES,
			emoji,
		);
		if (result.length === 0) {
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"No encontrado",
						`${emoji} no estaba configurado en <#${CONFIG.CHANNELS.MEMES}>.`,
					),
				],
			});
		}
		return ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Reacción eliminada",
					`Se eliminó ${emoji} de las reacciones automáticas en <#${CONFIG.CHANNELS.MEMES}>.`,
				),
			],
		});
	}

	private async handleListar(
		ctx: CommandContext<typeof options>,
		guildId: string,
	) {
		const rows = await memeReactionsRepository.findByChannel(
			guildId,
			CONFIG.CHANNELS.MEMES,
		);

		if (rows.length === 0) {
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Sin reacciones",
						`No hay reacciones automáticas configuradas en <#${CONFIG.CHANNELS.MEMES}>.`,
					),
				],
			});
		}

		const emojis = rows.map((r) => r.emoji).join(" ");
		return ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Reacciones automáticas",
					`<#${CONFIG.CHANNELS.MEMES}>: ${emojis}`,
				),
			],
		});
	}
}
