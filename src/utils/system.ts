import fs from "node:fs/promises";
import os from "node:os";

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
	const cpus = os.cpus();
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const usedMem = totalMem - freeMem;

	let totalLoad = 0;
	let manufacturer = "Unknown";
	let brand = "Unknown";
	let speed = 0;

	if (cpus.length > 0) {
		const cpu = cpus[0];
		if (cpu) {
			brand = cpu.model;
			manufacturer = brand.split(" ")[0] || "Unknown";
			speed = cpu.speed / 1000;
		}

		let totalIdle = 0;
		let totalTick = 0;
		for (const core of cpus) {
			if (!core) continue;
			for (const type in core.times) {
				totalTick += core.times[type as keyof typeof core.times];
			}
			totalIdle += core.times.idle;
		}
		totalLoad = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
	}

	const disks: SystemStats["disk"] = [];
	try {
		const stat = await fs.statfs("/");
		const size = stat.blocks * stat.bsize;
		const available = stat.bavail * stat.bsize;
		const used = size - available;
		disks.push({
			fs: "/",
			type: "local",
			size,
			used,
			available,
			use: size > 0 ? (used / size) * 100 : 0,
			mount: "/",
		});
	} catch {
		console.error("Failed to get disk stats");
	}

	return {
		cpu: {
			manufacturer,
			brand,
			cores: cpus.length,
			physicalCores: cpus.length,
			speed,
			load: totalLoad,
		},
		mem: {
			total: totalMem,
			used: usedMem,
			free: freeMem,
			usedPercent: (usedMem / totalMem) * 100,
		},
		os: {
			platform: os.platform(),
			distro: os.type(),
			release: os.release(),
			uptime: os.uptime(),
		},
		disk: disks,
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
