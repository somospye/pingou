import { Client, type ParseClient, type ParseMiddlewares } from "seyfert";
import type { CONFIG } from "./config/config";
import { middlewares } from "./middlewares";
import { bumpService } from "./services/bumpService";
import { cooldownService } from "./services/cooldown";
import { moderationService } from "./services/moderationService";
import { schedulerService } from "./services/scheduler";
import { voiceRestrictService } from "./services/voiceRestrictService";

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
			moderationService.cleanupExpiredLimits().catch(console.error);
		},
		1000 * 60 * 60,
	);

	await cooldownService.cleanup().catch(console.error);
	await moderationService.cleanupExpiredLimits().catch(console.error);
	await voiceRestrictService.recoverOnStartup(client).catch(console.error);
	await bumpService.ensureBumpRole(client).catch(console.error);
	await schedulerService.recoverOnStartup(client).catch(console.error);
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
