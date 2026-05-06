import { createEvent } from "seyfert";
import { handlePepedown } from "./pepedown";
import { handleStarboard } from "./starboard";

export default createEvent({
	data: { name: "messageReactionAdd" },
	async run(reaction, client) {
		await handleStarboard(reaction, client);
		await handlePepedown(reaction, client);
	},
});
