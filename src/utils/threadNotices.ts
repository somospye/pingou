import {
	ActionRow,
	Button,
	Container,
	Section,
	Separator,
	TextDisplay,
	Thumbnail,
} from "seyfert";
import type { MessageCreateBodyRequest } from "seyfert/lib/common";
import { ButtonStyle, MessageFlags, Spacing } from "seyfert/lib/types";

export const THREAD_CLOSE_PREFIX = "thread-close";
export const THREAD_CLOSE_CONFIRM_PREFIX = "thread-close-ok";
export const THREAD_CLOSE_CANCEL_ID = "thread-close-no";
export const THREAD_REPORT_PREFIX = "thread-report";

export type ThreadNoticeKind = "job" | "service" | "project";

interface ThreadNoticeData {
	kind: ThreadNoticeKind;
	authorId: string;
	/** Canal donde se publicó el post original */
	channelId: string;
	/** Id del post original (comparte id con el hilo) */
	messageId: string;
	iconUrl?: string;
}

const STAFF_NOTE =
	"-# El staff no interviene en tratos entre usuarios. Si tienes pruebas de una estafa, repórtala.";
const CONFIRM_COLOR = 0x5865f2;

export const NOTICES: Record<
	ThreadNoticeKind,
	{
		color: number;
		header: (authorId: string) => string;
		body: string;
		closeHint: string;
		closeLabel: string;
		reportLabel: string;
		closedTitle: string;
		confirmTitle: string;
		confirmDetail: string;
	}
> = {
	job: {
		color: 0x5865f2,
		header: (authorId) =>
			`## Oferta de empleo\nPublicada por <@${authorId}>. Postúlate en este hilo o escríbele por MD.`,
		body: [
			"### Antes de postularte",
			"- **Nunca pagues** para postularte ni para empezar a trabajar.",
			"- No compartas documentos ni datos bancarios sin verificar la empresa.",
			"- Acuerda el pago y los plazos por escrito.",
			"- Si el trabajo es por proyecto, cobra por hitos.",
		].join("\n"),
		closeHint: "-# **¿Ya cubriste el puesto?** Cierra la convocatoria.",
		closeLabel: "Cerrar convocatoria",
		reportLabel: "Reportar Oferta",
		closedTitle: "Convocatoria cerrada",
		confirmTitle: "**¿Cerrar convocatoria?**",
		confirmDetail:
			"-# El hilo se bloqueará y nadie más podrá responder ni postularse.",
	},
	service: {
		color: 0xf1c40f,
		header: (authorId) =>
			`## Servicio ofrecido\nPor <@${authorId}>. Pide un presupuesto en este hilo o escríbele por MD.`,
		body: [
			"### Si vas a contratar",
			"- Pide ver trabajos anteriores.",
			"- Acuerden el alcance, el precio y los plazos por escrito.",
			"- Paguen por hitos, **nunca todo por adelantado**.",
			"### Si ofreces el servicio",
			"- **No ejecutes** archivos ni repositorios que te mande un cliente sin revisarlos.",
		].join("\n"),
		closeHint: "-# **¿Ya no tomas trabajos?** Cierra la publicación.",
		closeLabel: "Cerrar publicación",
		reportLabel: "Reportar Servicio",
		closedTitle: "Publicación cerrada",
		confirmTitle: "**¿Cerrar publicación?**",
		confirmDetail: "-# El hilo se bloqueará y nadie más podrá responder.",
	},
	project: {
		color: 0x5865f2,
		header: (authorId) =>
			`## Proyecto no pago\nPublicado por <@${authorId}>. Si quieres sumarte, responde en este hilo o escríbele por MD.`,
		body: [
			"### Antes de sumarte",
			"- Acuerden por escrito qué aporta cada uno y de quién es el código.",
			"- Pide ver el repositorio o una demo antes de comprometerte.",
			"- **Nunca pagues** para participar en un proyecto.",
			"- **No ejecutes** archivos ni repositorios sin revisarlos.",
		].join("\n"),
		closeHint: "-# **¿Ya armaste el equipo?** Cierra la convocatoria.",
		closeLabel: "Cerrar convocatoria",
		reportLabel: "Reportar Proyecto",
		closedTitle: "Convocatoria cerrada",
		confirmTitle: "**¿Cerrar convocatoria?**",
		confirmDetail:
			"-# El hilo se bloqueará y nadie más podrá responder ni sumarse.",
	},
};

/**
 * Mensaje que Pingou publica dentro del hilo de cada post en los canales de
 * ofertas de empleo y de servicios. Usa Components V2, así que no lleva
 * `content` ni `embeds`: la mención al autor va dentro del primer texto y
 * `allowed_mentions` la habilita para que le llegue el aviso.
 */
export function buildThreadNotice(
	data: ThreadNoticeData,
): MessageCreateBodyRequest {
	const notice = NOTICES[data.kind];

	const headerText = new TextDisplay().setContent(notice.header(data.authorId));
	const header = data.iconUrl
		? new Section()
				.addComponents(headerText)
				.setAccessory(new Thumbnail().setMedia(data.iconUrl))
		: headerText;

	const buttons = new ActionRow<Button>().setComponents([
		new Button()
			.setCustomId(`${THREAD_CLOSE_PREFIX}:${data.kind}:${data.authorId}`)
			.setLabel(notice.closeLabel)
			.setStyle(ButtonStyle.Danger),
		new Button()
			.setCustomId(
				`${THREAD_REPORT_PREFIX}:${data.channelId}:${data.messageId}`,
			)
			.setLabel(notice.reportLabel)
			.setStyle(ButtonStyle.Secondary),
	]);

	const container = new Container()
		.setColor(notice.color)
		.addComponents(
			header,
			new Separator().setDivider(true).setSpacing(Spacing.Small),
			new TextDisplay().setContent(notice.body),
			new Separator().setDivider(true).setSpacing(Spacing.Small),
			new TextDisplay().setContent(`${notice.closeHint}\n${STAFF_NOTE}`),
			buttons,
		);

	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowed_mentions: { users: [data.authorId] },
	};
}

/**
 * Confirmación (efímera) antes de cerrar el hilo. Si quien cierra es un
 * miembro del staff y no el autor, le recuerda que debe tener un motivo, sin pedírselo.
 */
export function buildCloseConfirm(
	kind: ThreadNoticeKind,
	authorId: string,
	byStaff: boolean,
): MessageCreateBodyRequest {
	const notice = NOTICES[kind];
	const lines = [notice.confirmTitle];
	if (byStaff) {
		lines.push(
			"-# Esta publicación no es tuya. Como staff, ciérrala solo si tienes un motivo, por ejemplo que incumpla las reglas. No hace falta que lo escribas, pero queda registrado quién la cerró.",
		);
	}
	lines.push(notice.confirmDetail);

	return {
		components: [
			new Container()
				.setColor(CONFIRM_COLOR)
				.addComponents(
					new TextDisplay().setContent(lines.join("\n")),
					new ActionRow<Button>().setComponents([
						new Button()
							.setCustomId(`${THREAD_CLOSE_CONFIRM_PREFIX}:${kind}:${authorId}`)
							.setLabel("Cerrar")
							.setStyle(ButtonStyle.Danger),
						new Button()
							.setCustomId(THREAD_CLOSE_CANCEL_ID)
							.setLabel("Cancelar")
							.setStyle(ButtonStyle.Secondary),
					]),
				),
		],
		flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
	};
}

/**
 * Mensaje de estado corto (Components V2): título en negrita y, si hace
 * falta, un detalle en letra chica. Se usa para las respuestas del cierre.
 */
export function buildStatus(
	title: string,
	detail?: string,
	options: { ephemeral?: boolean } = {},
) {
	const text = detail ? `**${title}**\n-# ${detail}` : `**${title}**`;
	return {
		components: [
			new Container()
				.setColor(CONFIRM_COLOR)
				.addComponents(new TextDisplay().setContent(text)),
		],
		flags: options.ephemeral
			? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
			: MessageFlags.IsComponentsV2,
	};
}
