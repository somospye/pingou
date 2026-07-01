import {
	Command,
	type CommandContext,
	createStringOption,
	createUserOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { reportService } from "@/services/reportService";

const options = {
	usuario: createUserOption({
		description: "Usuario que quieres reportar",
		required: true,
	}),
	motivo: createStringOption({
		description: "Motivo del reporte",
		required: true,
		max_length: 1000,
	}),
	prueba: createStringOption({
		description: "Enlace o evidencia que respalde el reporte",
		max_length: 1000,
	}),
};

@Declare({
	name: "reportar",
	description: "Reporta a un usuario al staff",
	props: {
		cooldown: 60,
		cooldownKey: "report",
	},
})
@Options(options)
@Middlewares(["cooldown"])
export default class ReportCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario, motivo, prueba } = ctx.options;

		await ctx.deferReply(true);

		await reportService.sendReport(ctx.client, {
			reporterId: ctx.author.id,
			reporterTag: ctx.author.username,
			reportedUserId: usuario.id,
			reportedTag: usuario.username,
			reason: motivo,
			evidence: prueba,
		});

		await ctx.editOrReply({
			content: "Tu reporte fue enviado al staff. Gracias.",
		});
	}
}
