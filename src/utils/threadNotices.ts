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
	"-# El staff no puede intervenir en estafas ni resolver conflictos entre usuarios. Este canal está para dar visibilidad a las publicaciones, así que la precaución corre por tu cuenta. Si tienes pruebas de que alguien estafó, repórtalo y el staff puede quitarle el acceso a estos canales.";

const NOTICES: Record<
	ThreadNoticeKind,
	{
		color: number;
		header: (authorId: string) => string;
		body: string[];
		closeLabel: string;
	}
> = {
	job: {
		color: 0x5865f2,
		header: (authorId) =>
			`## Hilo de la oferta\nOferta publicada por <@${authorId}>. Para postularte o preguntar detalles, responde en este hilo o escríbele por MD.`,
		body: [
			[
				"### Antes de postularte",
				"- Una oferta de trabajo real no te cobra por postularte, por la capacitación ni por el equipo. Si te piden dinero para empezar, es una estafa.",
				"- No mandes tu documento de identidad ni tus datos bancarios hasta comprobar que la empresa existe.",
				"- Si la publicación no dice qué empresa es, cuál es el puesto o cuánto pagan, desconfía. También puedes reportarla.",
				"- Antes de empezar, acuerda por escrito el pago, los plazos y si los impuestos o comisiones van aparte.",
				"- Si el trabajo es por proyecto, cobra por hitos: entregas pequeñas que muestren avances reales.",
			].join("\n"),
			"-# ¿Publicaste la oferta? Cuando cubras el puesto, toca **Cerrar convocatoria** para que dejen de postularse.",
		],
		closeLabel: "Cerrar convocatoria",
	},
	service: {
		color: 0x57f287,
		header: (authorId) =>
			`## Hilo del servicio\nServicio ofrecido por <@${authorId}>. Si te interesa, pide un presupuesto en este hilo o escríbele por MD.`,
		body: [
			[
				"### Antes de contratar",
				"- Pide ver trabajos anteriores, como un portafolio o repositorios, antes de cerrar el trato.",
				"- Acuerden por escrito qué incluye el trabajo, el precio, los plazos y si los impuestos o comisiones van aparte.",
				"- Dividan el pago en hitos: entregas pequeñas que muestren avances reales. Ninguna de las partes debería pagar ni entregar todo hasta confiar en la otra.",
			].join("\n"),
			[
				"### Si ofreces el servicio",
				'- No ejecutes archivos ni repositorios que te mande un cliente para "probar" algo sin revisar antes el código. Así roban cuentas y tokens.',
				"- Cuando no tomes más trabajos, toca **Cerrar publicación**.",
			].join("\n"),
		],
		closeLabel: "Cerrar publicación",
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
			.setCustomId(`${THREAD_CLOSE_PREFIX}:${data.authorId}`)
			.setLabel(notice.closeLabel)
			.setEmoji("🔒")
			.setStyle(ButtonStyle.Danger),
		new Button()
			.setCustomId(
				`${THREAD_REPORT_PREFIX}:${data.channelId}:${data.messageId}`,
			)
			.setLabel("Reportar publicación")
			.setEmoji("🚩")
			.setStyle(ButtonStyle.Secondary),
	]);

	const container = new Container()
		.setColor(notice.color)
		.addComponents(
			header,
			new Separator().setDivider(true).setSpacing(Spacing.Small),
			...notice.body.map((text) => new TextDisplay().setContent(text)),
			new Separator().setDivider(true).setSpacing(Spacing.Small),
			new TextDisplay().setContent(STAFF_NOTE),
			buttons,
		);

	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowed_mentions: { users: [data.authorId] },
	};
}
