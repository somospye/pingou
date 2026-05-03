import { createEvent } from "seyfert";
import { CONFIG } from "../config/config";

export default createEvent({
	data: { once: false, name: "messageReactionAdd" },
	async run(reaction, user) {
		const guild = reaction.guildId;
		const memberId = reaction.messageAuthorId;
		const message = await user.messages.fetch(
			reaction.messageId,
			reaction.channelId,
		);
		const reactionObject = message.reactions?.find(
			(r) =>
				r.emoji.id === reaction.emoji.id &&
				r.emoji.name === reaction.emoji.name,
		);

		if (!(guild && memberId)) return;

		const member = await user.members.fetch(guild, memberId);
		try {
			if (
				reaction.emoji.id === CONFIG.EMOJIS.PEPEDOWN &&
				!member.roles.keys.includes(CONFIG.ROLES.PEPEDOWN)
			) {
				if (reactionObject?.count === 5 && memberId) {
					await user.members.addRole(guild, memberId, CONFIG.ROLES.PEPEDOWN);
					await user.messages.write(reaction.channelId, {
						content: `<@${memberId}> con rol correctamente`,
					});
				}

				setTimeout(
					() => {
						user.members.removeRole(guild, memberId, CONFIG.ROLES.PEPEDOWN);
					},
					1000 * 60 * 60,
				);
			}
		} catch (e) {
			console.error(e);
		}
	},
});
