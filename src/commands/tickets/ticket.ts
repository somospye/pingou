import { Command, Declare, Options } from "seyfert";
import { TicketCloseCommand } from "./close";
import { TicketSetupCommand } from "./setup";

@Declare({
	name: "ticket",
	description: "Sistema de tickets de soporte",
})
@Options([TicketSetupCommand, TicketCloseCommand])
export default class TicketCommand extends Command {}
