import z from "zod";

export const CONFIG = {
	GUILD_ID: "768278151435386900",
	EMOJIS: {
		PEPEDOWN: "768544166581633044",
		STAR: "⭐",
	},
	ROLES: {
		ADMIN: "808889381187485736",
		MODERATOR: "994980515335643267",
		HELPER: "1290753880191271007",
		RRHH: "1424546538289627277",
		RECRUITER: "1424544842809212988",
		PRIORITY_RECRUITER: "1501741014832910468",
		EVERYONE: "",
		NOVATO: "780597611496865792",
		PEPEDOWN: "1302062476266967201",
	},
	RESTRICTIONS: {
		VOZ: "1307455233814823014",
		FOROS: "1385798023485063369",
		EMPLEOS: "984278721055830047",
	},
	CHANNELS: {
		STARBOARD: "930504113718972516", // change this. ~elisiei
		SUGGESTIONS: "784608909817937920",
		JOBS_OFFERS: "793661563705360394",
		JOBS_VERIFICATION: "925121655578173440",
		CHAT_GENERAL: "768329192131526686",
		MOD_LOG: "844385995352047646",
		JOIN_LOG: "844386147626385418",
		BUMP: "768329192131526686",
		REP_NOTIFICATION: "925121655578173440",
		REP_LOG: "932871373280395314",
		CHAT_PROGRAMADORES: "807385882868580392",
		MEMES: "783188322087993346",
	},
	MEMES_REACTIONS: ["1502355338765013093", "♻️", "💤"] as string[],
	CATEGORIES: {
		FORUMS: "1290372079279145092",
	},
	AUTO_THREAD_CHANNELS: [
		"793661563705360394",
		"901578179431530496",
		"785303382314844160",
		"1344535477268774912",
		"924436818718494740",
		"1249222442199814257",
	],
	REPUTATION_FOR_PRIORITY: 5,
	REP_TIERS: [
		{ minPoints: 1, roleId: "806755636288815115" }, // Iniciante
		{ minPoints: 16, roleId: "805073774088945725" }, // Regular
		{ minPoints: 40, roleId: "780597430861168660" }, // Avanzado
		{ minPoints: 80, roleId: "1190365465327968256" }, // Veterano
		{ minPoints: 100, roleId: "769538041084903464" }, // Sabio
		{ minPoints: 150, roleId: "838285410995929119" }, // Experto
	],
	OTHER: {
		DISBOARD_ID: "302050872383242240",
		THANKS_TERMS: [
			"gracias",
			"grax",
			"grac",
			"muchas gracias",
			"mil gracias",
			"muchisimas gracias",
			"thanks",
			"thank you",
			"thankyou",
			"thx",
			"ty",
		],
	},
};

const Envscheme = z.object({
	POSTGRES_URL: z.string(),
	BOT_TOKEN: z.string(),
	PUBLIC_KEY: z.optional(z.string()),
	PORT: z.coerce.number().default(4444),
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
