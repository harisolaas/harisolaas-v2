import { createClient } from "redis";

// In-memory mock for local testing — only used when MOCK_REDIS=1
// Implements just the methods this codebase uses: get, set, incr, sMembers, sAdd, keys.
function createMockRedis() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return {
    on: () => {},
    connect: async () => {},
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<string> {
      store.set(key, value);
      return "OK";
    },
    async incr(key: string): Promise<number> {
      const current = Number(store.get(key) ?? 0);
      const next = current + 1;
      store.set(key, String(next));
      return next;
    },
    async sAdd(key: string, value: string): Promise<number> {
      let set = sets.get(key);
      if (!set) {
        set = new Set();
        sets.set(key, set);
      }
      const had = set.has(value);
      set.add(value);
      return had ? 0 : 1;
    },
    async sRem(key: string, value: string): Promise<number> {
      const set = sets.get(key);
      if (!set) return 0;
      return set.delete(value) ? 1 : 0;
    },
    async sMembers(key: string): Promise<string[]> {
      return Array.from(sets.get(key) ?? []);
    },
    async del(key: string): Promise<number> {
      const had = store.delete(key) || sets.delete(key);
      return had ? 1 : 0;
    },
    async keys(pattern: string): Promise<string[]> {
      const re = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return Array.from(store.keys()).filter((k) => re.test(k));
    },
  };
}

const useMock = process.env.MOCK_REDIS === "1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

if (useMock) {
  console.log("[redis] Using in-memory mock (MOCK_REDIS=1)");
  client = createMockRedis();
} else {
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (err: Error) => console.error("Redis error:", err));
}

let connected = false;

export async function getRedis() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}
