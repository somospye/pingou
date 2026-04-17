import { Client, type ParseClient, type ParseMiddlewares } from "seyfert";
import type { CONFIG } from "./config/config";
import { middlewares } from "./middlewares";
import { cooldownService } from "./services/cooldown";

async function boostrap() {
	const client = new Client();

	client.setServices({
		middlewares: middlewares,
	});

	await client.start();
	await client.uploadCommands({
		cachePath: "./commands.json",
	});

	setInterval(
		() => {
			cooldownService.cleanup().catch(console.error);
		},
		1000 * 60 * 60,
	);

	await cooldownService.cleanup().catch(console.error);
}

await boostrap().catch((error) => {
	console.log(error);
	process.exit(1);
});

type Roles = (typeof CONFIG.ROLES)[keyof typeof CONFIG.ROLES];

declare module "seyfert" {
	interface UsingClient extends ParseClient<Client<true>> {}

	interface RegisteredMiddlewares
		extends ParseMiddlewares<typeof middlewares> {}

	interface ExtraProps {
		requiredRoles?: Roles[];
		cooldown?: number;
		cooldownKey?: string;
	}
}
