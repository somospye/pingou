import { Command, Declare, Options } from "seyfert";
import { VoiceStatsCommand } from "./stats";
import { VoiceTopCommand } from "./top";

@Declare({
	name: "voz",
	description: "Puntos por actividad en canales de voz",
})
@Options([VoiceStatsCommand, VoiceTopCommand])
export default class VozCommand extends Command {}
