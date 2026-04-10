import { Embed } from "seyfert";

export const Embeds = {
	successEmbed(title: string, description?: string): Embed {
		return new Embed()
			.setTitle(title)
			.setDescription(description)
			.setColor("Green");
	},
	errorEmbed(title: string, description?: string): Embed {
		return new Embed()
			.setTitle(title)
			.setDescription(description)
			.setColor("Red");
	},

	noPermissionsEmbed(): Embed {
		return new Embed()
			.setColor("Red")
			.setTitle("🚫 Acceso Denegado")
			.setDescription("No tienes permiso para usar este comando.");
	},
};
