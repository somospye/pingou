import { Client, type ParseClient, type ParseMiddlewares } from "seyfert";
import type { CONFIG } from "./config/config";
import { middlewares } from "./middlewares";

async function boostrap() {
	const client = new Client();

	client.setServices({
		middlewares: middlewares,
	}),
		client.start().then(() =>
			client.uploadCommands({
				cachePath: "./commands.json",
			}),
		);
}

boostrap().catch((error) => {
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
	}
}
