import { createEvent } from "seyfert";
import { handleStarboard } from "./starboard";
import { handlePepedown } from "./pepedown";

export default createEvent({
    data: { name: "messageReactionAdd" },
    async run(reaction, client) {
        await handleStarboard(reaction, client);
        await handlePepedown(reaction, client);
    },
});
