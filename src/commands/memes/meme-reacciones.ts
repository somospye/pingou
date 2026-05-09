import {
	Command,
	type CommandContext,
	createChannelOption,
	createStringOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { ChannelType } from "seyfert/lib/types";
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
	canal: createChannelOption({
		description: "Canal al que aplicar la acción",
		required: false,
		channel_types: [ChannelType.GuildText],
	}),
	emoji: createStringOption({
		description: "Emoji a agregar o eliminar",
		required: false,
	}),
};

@Declare({
	name: "meme-reacciones",
	description: "Configura las reacciones automáticas en canales de memes",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class MemeReaccionesCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { accion, canal, emoji } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId) return;

		await ctx.deferReply(true);

		try {
			if (accion === "listar") {
				return await this.handleListar(ctx, guildId, canal?.id);
			}

			if (!canal) {
				return ctx.editOrReply({
					embeds: [
						Embeds.errorEmbed(
							"Falta el canal",
							"Tenés que especificar un canal para esta acción.",
						),
					],
				});
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
				return await this.handleAgregar(ctx, guildId, canal.id, emoji);
			}

			if (accion === "eliminar") {
				return await this.handleEliminar(ctx, guildId, canal.id, emoji);
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
		channelId: string,
		emoji: string,
	) {
		const result = await memeReactionsRepository.add(guildId, channelId, emoji);
		if (result.length === 0) {
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Ya existe",
						`${emoji} ya es una reacción automática en <#${channelId}>.`,
					),
				],
			});
		}
		return ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Reacción agregada",
					`Se agregó ${emoji} como reacción automática en <#${channelId}>.`,
				),
			],
		});
	}

	private async handleEliminar(
		ctx: CommandContext<typeof options>,
		guildId: string,
		channelId: string,
		emoji: string,
	) {
		const result = await memeReactionsRepository.remove(
			guildId,
			channelId,
			emoji,
		);
		if (result.length === 0) {
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"No encontrado",
						`${emoji} no estaba configurado en <#${channelId}>.`,
					),
				],
			});
		}
		return ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Reacción eliminada",
					`Se eliminó ${emoji} de las reacciones automáticas en <#${channelId}>.`,
				),
			],
		});
	}

	private async handleListar(
		ctx: CommandContext<typeof options>,
		guildId: string,
		channelId?: string,
	) {
		const rows = channelId
			? await memeReactionsRepository.findByChannel(guildId, channelId)
			: await memeReactionsRepository.findByGuild(guildId);

		if (rows.length === 0) {
			const scope = channelId ? `<#${channelId}>` : "este servidor";
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Sin reacciones",
						`No hay reacciones automáticas configuradas en ${scope}.`,
					),
				],
			});
		}

		const grouped = rows.reduce<Record<string, string[]>>((acc, row) => {
			if (!acc[row.channelId]) acc[row.channelId] = [];
			acc[row.channelId].push(row.emoji);
			return acc;
		}, {});

		const description = Object.entries(grouped)
			.map(([ch, emojis]) => `<#${ch}>: ${emojis.join(" ")}`)
			.join("\n");

		return ctx.editOrReply({
			embeds: [Embeds.successEmbed("Reacciones automáticas", description)],
		});
	}
}
