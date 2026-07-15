import { createEvent } from "seyfert";
import { voiceActivityService } from "@/services/voiceActivityService";

export default createEvent({
	data: { once: false, name: "voiceStateUpdate" },
	async run([state, oldState]) {
		// Same channel means a mute/deaf/stream toggle — not a session boundary
		if (state.channelId === oldState?.channelId) return;

		const user = await state.user().catch(() => null);
		if (!user || user.bot) return;

		if (state.channelId) {
			// Join or move — upsert restarts tracking on the new channel
			await voiceActivityService.startSession(state.userId, state.channelId);
		} else {
			await voiceActivityService.endSession(state.userId);
		}
	},
});
