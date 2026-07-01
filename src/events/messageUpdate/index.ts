import { createEvent, type Message } from "seyfert";
import { handleWordCensor } from "../messageCreate/wordCensor";

export default createEvent({
	data: { once: false, name: "messageUpdate" },
	async run([message, _old], client) {
		if (message.author?.bot) return;
		if (!message.content) return;

		await handleWordCensor(message as Message, client);
	},
});
