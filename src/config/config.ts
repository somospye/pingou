import z from "zod";

export const CONFIG = {
	GUILD_ID: "",
	EMOJIS: {
		PEPEDOWN: "768544166581633044",
	},
	ROLES: {
		ADMIN: "1400004966042701834",
		MODERATOR: "1400004966029983793",
		HELPER: "1400004965979918391",
		RRHH: "",
		RECRUITER: "",
		PRIORITY_RECRUITER: "",
		EVERYONE: "",
		NOVATO: "1400004966000623621",
		PEPEDOWN: "1400004966029983790",
	},
	RESTRICTIONS: {
		VOZ: "1497370444058198207",
		FOROS: "1400004966009147436",
		EMPLEOS: "1400004966000623620",
	},
	CHANNELS: {
		SUGGESTIONS: "1400004969935011849",
		JOBS_OFFERS: "1400004970115235939",
		JOBS_VERIFICATION: "1400004970115235932",
		CHAT_GENERAL: "1400004970115235932",
		MOD_LOG: "1400004970115235932",
		JOIN_LOG: "1400004970115235933",
		BUMP: "",
		REP_NOTIFICATION: "1498069342506713159",
		REP_LOG: "1498048755721830593",
		CHAT_PROGRAMADORES: "1400004970115235933",
	},
	CATEGORIES: {
		FORUMS: "1400004970115235938",
	},
	AUTO_THREAD_CHANNELS: ["1498021513222160425"],
	REPUTATION_FOR_PRIORITY: 5,
	REP_TIERS: [
		{ minPoints: 10, roleId: "1400004966000623622" }, // Iniciante
		{ minPoints: 30, roleId: "1400004966000623623" }, // Regular
		{ minPoints: 40, roleId: "1400004966000623624" }, // Avanzado
		{ minPoints: 50, roleId: "1400004966000623625" }, // Veterano
		{ minPoints: 60, roleId: "1400004966009147434" }, // Sabio
		{ minPoints: 70, roleId: "1400004966009147435" }, // Experto
	],
};

const Envscheme = z.object({
	POSTGRES_URL: z.string(),
	BOT_TOKEN: z.string(),
	PUBLIC_KEY: z.string(),
	PORT: z.coerce.number(),
});
type Env = z.infer<typeof Envscheme>;

const Environment = (): Env => {
	const result = Envscheme.safeParse(process.env);
	if (!result.success) {
		const errorMessages = result.error.issues.map(
			(issue) => `Field ${issue.path.join(".")} | Error ${issue.message}`,
		);
		throw new Error(`Invalid Environment Variables:\n${errorMessages}`);
	}
	return result.data;
};

export const env = Environment() as Env;
