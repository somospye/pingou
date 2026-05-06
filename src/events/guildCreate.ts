import { createEvent } from "seyfert";
import { inviteService } from "@/services/inviteService";

export default createEvent({
	data: { once: true, name: "guildsReady" },
	async run(_data, client) {
		const result = await client.guilds.list().catch(() => []);
		const guilds = Array.isArray(result) ? result : Object.values(result);

		for (const guild of guilds as { id: string }[]) {
			await inviteService.initGuild(client, guild.id).catch(console.error);
		}
	},
});
