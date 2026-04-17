import { ActionRow, Button, ModalCommand, type ModalContext } from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "../config/config";
import { jobService } from "../services/jobService";
import { Embeds } from "../utils/embeds";

export default class JobModal extends ModalCommand {
	override filter(ctx: ModalContext) {
		return ctx.customId === "job-modal";
	}

	override async run(ctx: ModalContext) {
		const title = ctx.interaction.getInputValue("title", true) as string;
		const description = ctx.interaction.getInputValue(
			"description",
			true,
		) as string;
		const requirements = ctx.interaction.getInputValue(
			"requirements",
			true,
		) as string;
		const salary = ctx.interaction.getInputValue("salary", false) as
			| string
			| undefined;
		const contact = ctx.interaction.getInputValue("contact", true) as string;

		const userRoles = ctx.member?.roles.keys ?? [];
		const isPriority =
			userRoles.includes(CONFIG.ROLES.RRHH) ||
			userRoles.includes(CONFIG.ROLES.RECRUITER) ||
			userRoles.includes(CONFIG.ROLES.PRIORITY_RECRUITER) ||
			userRoles.includes(CONFIG.ROLES.ADMIN) ||
			userRoles.includes(CONFIG.ROLES.MODERATOR);

		if (isPriority) {
			await this.publishJob(ctx, {
				title,
				description,
				requirements,
				salary,
				contact,
				userId: ctx.author.id,
			});

			return ctx.write({
				content: "✅ Tu oferta de empleo ha sido publicada directamente.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const verificationEmbed = Embeds.jobVerificationEmbed({
			title,
			description,
			requirements,
			salary,
			contact,
			authorName: ctx.author.username,
			authorIcon: ctx.author.avatarURL(),
			authorId: ctx.author.id,
		});

		const buttons = new ActionRow<Button>().setComponents([
			new Button()
				.setCustomId(`job-approve-${ctx.author.id}`)
				.setLabel("Aprobar")
				.setStyle(ButtonStyle.Success),
			new Button()
				.setCustomId(`job-reject-${ctx.author.id}`)
				.setLabel("Rechazar")
				.setStyle(ButtonStyle.Danger),
		]);

		const verificationMsg = await ctx.client.messages.write(
			CONFIG.CHANNELS.JOBS_VERIFICATION,
			{
				embeds: [verificationEmbed],
				components: [buttons],
			},
		);

		await jobService.createPendingJob({
			id: verificationMsg.id,
			userId: ctx.author.id,
			title,
			description,
			requirements,
			salary: salary || undefined,
			contact,
		});

		return ctx.write({
			content:
				"📩 Tu oferta ha sido enviada al staff para su revisión. Te notificaremos cuando sea aprobada.",
			flags: MessageFlags.Ephemeral,
		});
	}

	private async publishJob(
		ctx: ModalContext,
		data: {
			title: string;
			description: string;
			requirements: string;
			salary?: string | null;
			contact: string;
			userId: string;
		},
	) {
		const jobEmbed = Embeds.jobOfferEmbed({
			...data,
			authorName: `Publicado por: ${ctx.author?.username || data.userId}`,
			authorIcon: ctx.author?.avatarURL(),
		});

		await ctx.client.messages.write(CONFIG.CHANNELS.JOBS_OFFERS, {
			content: `Nueva oferta de empleo de <@${data.userId}>:`,
			embeds: [jobEmbed],
		});
	}
}
