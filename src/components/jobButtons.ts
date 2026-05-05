import { ComponentCommand, type ComponentContext } from "seyfert";
import { CONFIG } from "@/config";
import { jobReputationRepository } from "@/repositories/jobReputationRepository";
import { jobService } from "@/services/jobService";
import { Embeds } from "@/utils/embeds";
import { fetchDisplayUser } from "@/utils/moderation";

export default class JobButtons extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return (
			ctx.customId.startsWith("job-approve-") ||
			ctx.customId.startsWith("job-reject-")
		);
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		if (ctx.customId.startsWith("job-approve-")) {
			return this.handleApprove(ctx);
		}

		if (ctx.customId.startsWith("job-reject-")) {
			return this.handleReject(ctx);
		}
	}

	private getUserIdFromCustomId(customId: string) {
		return customId.split("-")[2];
	}

	private async handleApprove(
		ctx: ComponentContext<typeof this.componentType>,
	) {
		const userId = this.getUserIdFromCustomId(ctx.customId);
		if (!userId) return;

		const jobId = ctx.interaction.message.id;

		await ctx.deferUpdate();

		const jobData = await jobService.getPendingJob(jobId);
		if (!jobData) {
			return ctx.editResponse({
				content: "❌ No se encontró la información de esta oferta.",
				embeds: [],
				components: [],
			});
		}

		const user = await fetchDisplayUser(ctx.client, userId);

		const jobEmbed = Embeds.jobOfferEmbed({
			...jobData,
			authorName: `Publicada por ${user.tag}`,
			authorIcon: user.avatar,
		});

		await ctx.client.messages.write(CONFIG.CHANNELS.JOBS_OFFERS, {
			content: `Nueva oferta de empleo!`,
			embeds: [jobEmbed],
		});

		const newPoints = await jobReputationRepository.addReputation(userId);
		const promoted = await jobService.checkAndAssignPriorityRole(
			ctx.client,
			ctx.guildId || "",
			userId,
		);

		await jobService.deletePendingJob(jobId);

		const approvedEmbed = Embeds.jobApprovedEmbed(userId, newPoints, promoted);

		await ctx.editResponse({
			embeds: [approvedEmbed],
			components: [],
		});

		try {
			await ctx.client.users.write(userId, {
				content: `🎉 Tu oferta de empleo **${jobData.title}** ha sido aprobada y publicada en <#${CONFIG.CHANNELS.JOBS_OFFERS}>.`,
			});
		} catch {
			await ctx.client.messages.write(CONFIG.CHANNELS.CHAT_GENERAL, {
				content: `<@${userId}> 🎉 Tu oferta de empleo **${jobData.title}** ha sido aprobada y publicada en <#${CONFIG.CHANNELS.JOBS_OFFERS}>. (Te envié esto por aquí porque tienes los MD bloqueados)`,
			});
		}
	}

	private async handleReject(ctx: ComponentContext<typeof this.componentType>) {
		const userId = this.getUserIdFromCustomId(ctx.customId);
		if (!userId) return;

		const jobId = ctx.interaction.message.id;

		await ctx.deferUpdate();

		const jobData = await jobService.getPendingJob(jobId);
		await jobService.deletePendingJob(jobId);

		const rejectedEmbed = Embeds.jobRejectedEmbed(userId);

		await ctx.editResponse({
			embeds: [rejectedEmbed],
			components: [],
		});

		try {
			await ctx.client.users.write(userId, {
				content: `⚠️ Tu oferta de empleo **${jobData?.title || "desconocida"}** ha sido rechazada por el staff. Asegúrate de seguir las normas del canal.`,
			});
		} catch {
			await ctx.client.messages.write(CONFIG.CHANNELS.CHAT_GENERAL, {
				content: `<@${userId}> ⚠️ Tu oferta de empleo **${jobData?.title || "desconocida"}** ha sido rechazada por el staff. (Te envié esto por aquí porque tienes los MD bloqueados)`,
			});
		}
	}
}
