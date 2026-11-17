import type { UsingClient } from "seyfert";

const DISCORD_MAX_LENGTH = 2000;
// Discord muestra "escribiendo..." unos 10 segundos o hasta que el bot manda
// un mensaje, así que lo renovamos antes de que se apague.
const TYPING_INTERVAL_MS = 8_000;

/**
 * Muestra "Pingou está escribiendo..." en el canal hasta que se llame a la
 * función devuelta. El indicador también se quita solo cuando el bot envía
 * un mensaje.
 */
export function startTyping(client: UsingClient, channelId: string) {
	const send = () => client.channels.typing(channelId).catch(() => {});
	send();
	const timer = setInterval(send, TYPING_INTERVAL_MS);
	return () => clearInterval(timer);
}

/**
 * Divide una respuesta en mensajes de hasta 2000 caracteres. Corta por
 * líneas y, si un bloque de código queda partido, lo cierra al final del
 * mensaje y lo vuelve a abrir (con el mismo lenguaje) en el siguiente.
 */
export function splitForDiscord(
	text: string,
	max = DISCORD_MAX_LENGTH,
): string[] {
	// Margen para cerrar y reabrir un bloque de código (```lenguaje)
	const limit = max - 40;
	const lines = text
		.split("\n")
		.flatMap((line) =>
			line.length <= limit
				? [line]
				: (line.match(new RegExp(`[\\s\\S]{1,${limit}}`, "g")) ?? [line]),
		);

	const chunks: string[] = [];
	let current = "";
	let openFence: string | null = null;

	for (const line of lines) {
		const candidate = current ? `${current}\n${line}` : line;
		if (candidate.length > limit && current.trim()) {
			chunks.push(openFence ? `${current}\n\`\`\`` : current);
			current = openFence ? `${openFence}\n${line}` : line;
		} else {
			current = candidate;
		}

		if (line.trimStart().startsWith("```")) {
			openFence = openFence ? null : line.trim();
		}
	}

	if (current.trim()) chunks.push(current);
	return chunks;
}

/**
 * Limpia una respuesta de la IA antes de mandarla, sin tocar el código:
 * quita citas tipo [1] o [1][2] y envuelve los links en <> para que
 * Discord no genere vistas previas (también los de [texto](url)).
 */
export function cleanAiText(text: string): string {
	return text
		.split(/(```[\s\S]*?```|`[^`\n]*`)/)
		.map((part, i) => {
			// Las partes impares son bloques o fragmentos de código
			if (i % 2 === 1) return part;
			return part
				.replace(/ ?\[\d+\](?:\[\d+\])*(?!\()/g, "")
				.replace(/\]\((https?:\/\/[^\s)>]+)\)/g, "](<$1>)")
				.replace(
					/(^|[^<(\w])(https?:\/\/[^\s<>()]+?)([.,;:!?]*)(?=\s|$)/gm,
					"$1<$2>$3",
				);
		})
		.join("");
}

/** Agrega la fuente al final cuando la respuesta usó una sola página. */
export function withSingleSource(text: string, sourceUrls?: string[]): string {
	if (sourceUrls?.length !== 1) return text;
	// Los <> evitan que Discord genere la vista previa del link
	return `${text}\n-# Fuente: <${sourceUrls[0]}>`;
}
