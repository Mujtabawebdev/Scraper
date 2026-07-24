import os from "node:os";
import process from "node:process";
import { prisma } from "../database/prisma.js";
import { checkRedisHealth } from "../redis/redis.health.js";

export type SystemMetrics = {
  service: string;
  uptimeSeconds: number;
  timestamp: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpus: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    loadAverage: number[];
  };
  process: {
    pid: number;
    memoryUsage: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
    };
    cpuUsage: NodeJS.CpuUsage;
  };
  dependencies: {
    database: "connected" | "disconnected";
    redis: "connected" | "disconnected";
  };
};

export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  const [dbResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    checkRedisHealth(),
  ]);

  const database = dbResult.status === "fulfilled" ? "connected" : "disconnected";
  const redis = redisResult.status === "fulfilled" ? "connected" : "disconnected";
  const mem = process.memoryUsage();

  return {
    service: "@lead-saas/api",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      loadAverage: os.loadavg(),
    },
    process: {
      pid: process.pid,
      memoryUsage: {
        rssBytes: mem.rss,
        heapTotalBytes: mem.heapTotal,
        heapUsedBytes: mem.heapUsed,
        externalBytes: mem.external,
      },
      cpuUsage: process.cpuUsage(),
    },
    dependencies: {
      database,
      redis,
    },
  };
};

export const getPrometheusMetricsString = (metrics: SystemMetrics): string => {
  return [
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${metrics.uptimeSeconds}`,
    `# HELP process_heap_bytes Process heap memory used in bytes`,
    `# TYPE process_heap_bytes gauge`,
    `process_heap_bytes ${metrics.process.memoryUsage.heapUsedBytes}`,
    `# HELP dependency_up State of system dependencies (1 = up, 0 = down)`,
    `# TYPE dependency_up gauge`,
    `dependency_up{name="database"} ${metrics.dependencies.database === "connected" ? 1 : 0}`,
    `dependency_up{name="redis"} ${metrics.dependencies.redis === "connected" ? 1 : 0}`,
  ].join("\n");
};
