import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });

client.on("error", (err) => console.error("Redis error:", err));

let connected = false;

export async function getRedis() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}
