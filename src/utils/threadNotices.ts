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
export const THREAD_REPORT_PREFIX = "thread-report";

export type ThreadNoticeKind = "job" | "service";

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

export const NOTICES: Record<
	ThreadNoticeKind,
	{
		color: number;
		header: (authorId: string) => string;
		body: string;
		closeHint: string;
		closeLabel: string;
		closedTitle: string;
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
		closeHint: "-# ¿Ya cubriste el puesto? Cierra la convocatoria.",
		closeLabel: "Cerrar convocatoria",
		closedTitle: "Convocatoria cerrada",
	},
	service: {
		color: 0x57f287,
		header: (authorId) =>
			`## Servicio ofrecido\nPor <@${authorId}>. Pide un presupuesto en este hilo o escríbele por MD.`,
		body: [
			"### Si vas a contratar",
			"- Pide ver trabajos anteriores.",
			"- Acuerden el alcance, el precio y los plazos por escrito.",
			"- Paguen por hitos, **nunca todo por adelantado**.",
			"",
			"### Si ofreces el servicio",
			"- **No ejecutes** archivos ni repositorios que te mande un cliente sin revisarlos.",
		].join("\n"),
		closeHint: "-# ¿Ya no tomas trabajos? Cierra la publicación.",
		closeLabel: "Cerrar publicación",
		closedTitle: "Publicación cerrada",
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
			.setEmoji("🔒")
			.setStyle(ButtonStyle.Danger),
		new Button()
			.setCustomId(
				`${THREAD_REPORT_PREFIX}:${data.channelId}:${data.messageId}`,
			)
			.setLabel("Reportar")
			.setEmoji("🚩")
			.setStyle(ButtonStyle.Secondary),
	]);

	const container = new Container()
		.setColor(notice.color)
		.addComponents(
			header,
			new Separator().setDivider(true).setSpacing(Spacing.Large),
			new TextDisplay().setContent(notice.body),
			new Separator().setDivider(true).setSpacing(Spacing.Large),
			new TextDisplay().setContent(`${notice.closeHint}\n${STAFF_NOTE}`),
			buttons,
		);

	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowed_mentions: { users: [data.authorId] },
	};
}
