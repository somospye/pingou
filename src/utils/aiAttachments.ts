import type { Message } from "seyfert";
import { CONFIG } from "@/config";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 4;
const TEXT_EXTENSIONS =
	/\.(txt|md|log|json|ya?ml|toml|ini|env\.example|csv|xml|html?|css|s[ac]ss|js|jsx|ts|tsx|mjs|cjs|py|java|kt|c|h|cpp|hpp|cs|go|rs|rb|php|swift|sql|sh|bash|lua|dart|vue|svelte)$/i;

export interface LoadedAttachments {
	images: string[];
	files: { name: string; text: string }[];
	skipped: string[];
}

/**
 * Descarga los adjuntos de un mensaje que menciona a Pingou (los adjuntos de
 * esos mensajes llegan sin Message Content). Las imágenes se convierten a
 * data URL en base64 y los archivos de texto se leen recortados. Lo que no
 * se puede usar queda en `skipped`.
 */
export async function loadAttachments(
	message: Message,
): Promise<LoadedAttachments> {
	const result: LoadedAttachments = { images: [], files: [], skipped: [] };
	const { MAX_TEXT_BYTES, MAX_TEXT_CHARS } = CONFIG.AI.ATTACHMENTS;

	for (const att of message.attachments) {
		const type = att.contentType ?? "";
		try {
			if (type.startsWith("image/")) {
				if (result.images.length >= MAX_IMAGES || att.size > MAX_IMAGE_BYTES) {
					result.skipped.push(att.filename);
					continue;
				}
				const res = await fetch(att.url);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
				result.images.push(`data:${type};base64,${base64}`);
				continue;
			}

			const isText =
				type.startsWith("text/") ||
				type.includes("json") ||
				TEXT_EXTENSIONS.test(att.filename);
			if (isText && att.size <= MAX_TEXT_BYTES) {
				const res = await fetch(att.url);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const text = (await res.text()).slice(0, MAX_TEXT_CHARS);
				result.files.push({ name: att.filename, text });
				continue;
			}

			result.skipped.push(att.filename);
		} catch (err) {
			console.error(`Failed to load attachment ${att.filename}:`, err);
			result.skipped.push(att.filename);
		}
	}

	return result;
}
