import { createEvent } from "seyfert";
import { inviteService } from "@/services/inviteService";

export default createEvent({
	data: { once: false, name: "inviteCreate" },
	async run(invite) {
		if (!invite.guildId || !invite.inviter) return;
		await inviteService.trackCreated(
			invite.code,
			invite.inviter.id,
			invite.guildId,
		);
	},
});
