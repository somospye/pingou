import { createEvent } from "seyfert";
import { inviteRepository } from "@/repositories/inviteRepository";

export default createEvent({
    data: { once: false, name: "guildMemberRemove" },
    async run(member) {
        const guildId = member.guildId;
        const userId = "id" in member ? member.id : member.user.id;

        const latestJoin = await inviteRepository
            .findLatestJoin(userId, guildId)
            .catch(() => null);

        if (!latestJoin?.inviterId) return;

        await inviteRepository
            .decrementStat(latestJoin.inviterId, guildId)
            .catch(() => { });
    },
});
