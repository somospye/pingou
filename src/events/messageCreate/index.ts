import { createEvent } from "seyfert";
import { CONFIG } from "@/config";
import { bumpService } from "@/services/bumpService";
import { handleAiMention } from "./aiMention";
import { handleAutoThread } from "./autoThread";
import { handleMemes } from "./memes";
import { handleThanks } from "./thanks";
import { handleWordCensor } from "./wordCensor";

/**
 * Único handler de `messageCreate`. Seyfert almacena handlers como
 * `this.values[eventName] = instance` — si hubiera dos archivos con el
 * mismo `name` el último cargado sobrescribiría al anterior silenciosamente.
 * Por eso consolidamos toda la lógica de mensajes acá y delegamos a
 * sub-handlers en archivos hermanos, mismo patrón que
 * `src/events/messageReactionAdd/`.
 *
 * - wordCensor: corre primero — un mensaje censurado se borra y no debe
 *   disparar memes, threads, IA ni gracias
 * - memes: aditivo (corre junto a los demás)
 * - autoThread / aiMention / thanks: mutuamente excluyentes. Devuelven
 *   `Promise<boolean>` indicando si manejaron el mensaje. Índex corta la
 *   cadena con `if (await handleX(...)) return;`.
 */
export default createEvent({
	data: { once: false, name: "messageCreate" },
	async run(message, client) {
		// Disboard tiene flag bot:true; lo procesamos antes de filtrar bots
		if (message.author.id === CONFIG.OTHER.DISBOARD_ID) {
			await bumpService.handleBump(message);
			return;
		}

		if (message.author.bot) return;

		if (await handleWordCensor(message, client)) return;

		// Aditivo — corre y deja seguir la cadena
		await handleMemes(message, client);

		// Mutuamente excluyentes — el primero que aplique corta la cadena
		if (await handleAutoThread(message, client)) return;
		if (await handleAiMention(message, client)) return;
		await handleThanks(message, client);
	},
});
