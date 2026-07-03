import { Command, Declare, Options } from "seyfert";
import { BalanceSubCommand } from "./balance";
import { DailySubCommand } from "./daily";
import { RobSubCommand } from "./robar";
import { TopSubCommand } from "./top";
import { WorkSubCommand } from "./trabajar";
import { TransferSubCommand } from "./transferir";

@Declare({
	name: "eco",
	description: "Sistema de economía de PyE Coins",
})
@Options([
	BalanceSubCommand,
	DailySubCommand,
	WorkSubCommand,
	RobSubCommand,
	TransferSubCommand,
	TopSubCommand,
])
export default class EcoCommand extends Command {}
