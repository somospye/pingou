import { createEvent } from "seyfert";
import { inviteService } from "@/services/inviteService";

export default createEvent({
    data: { once: false, name: "inviteDelete" },
    async run(invite) {
        if (!invite.guildId) return;
        inviteService.cacheRemove(invite.code, invite.guildId);
    },
});
