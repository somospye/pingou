import si from "systeminformation";

export interface SystemStats {
	cpu: {
		manufacturer: string;
		brand: string;
		cores: number;
		physicalCores: number;
		speed: number;
		load: number;
	};
	mem: {
		total: number;
		used: number;
		free: number;
		usedPercent: number;
	};
	os: {
		platform: string;
		distro: string;
		release: string;
		uptime: number;
	};
	disk: Array<{
		fs: string;
		type: string;
		size: number;
		used: number;
		available: number;
		use: number;
		mount: string;
	}>;
}

export async function getSystemStats(): Promise<SystemStats> {
	const [cpu, mem, osInfo, disks] = await Promise.all([
		si.cpu(),
		si.mem(),
		si.osInfo(),
		si.fsSize(),
	]);

	return {
		cpu: {
			manufacturer: cpu.manufacturer,
			brand: cpu.brand,
			cores: cpu.cores,
			physicalCores: cpu.physicalCores,
			speed: cpu.speed,
			load: cpu.speed === 0 ? 0 : (await si.currentLoad()).currentLoad,
		},
		mem: {
			total: mem.total,
			used: mem.used,
			free: mem.free,
			usedPercent: (mem.used / mem.total) * 100,
		},
		os: {
			platform: osInfo.platform,
			distro: osInfo.distro,
			release: osInfo.release,
			uptime: (await si.time()).uptime,
		},
		disk: disks.map((d) => ({
			fs: d.fs,
			type: d.type,
			size: d.size,
			used: d.used,
			available: d.available,
			use: d.use,
			mount: d.mount,
		})),
	};
}

export function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let i = 0;
	let size = bytes;
	while (size >= 1024 && i < units.length - 1) {
		size /= 1024;
		i++;
	}
	return `${size.toFixed(2)} ${units[i]}`;
}

export function formatUptime(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	return parts.join(" ") || "<1m";
}
