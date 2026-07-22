import { createRedisClient } from "./redis.connection.js";

const redisHealthClient = createRedisClient(true);

export const checkRedisHealth = async (): Promise<void> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const ping = async (): Promise<void> => {
    if (redisHealthClient.status === "wait" || redisHealthClient.status === "end") {
      await redisHealthClient.connect();
    }
    const response = await redisHealthClient.ping();
    if (response !== "PONG") throw new Error("Unexpected Redis health response");
  };

  try {
    await Promise.race([
      ping(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Redis health check timed out")), 3_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const disconnectRedisHealthClient = async (): Promise<void> => {
  if (redisHealthClient.status !== "end") await redisHealthClient.quit();
};
