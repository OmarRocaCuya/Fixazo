import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { EnricherError, createEnricherClient } from "../src/client.ts";
import { sample } from "./helpers.ts";

/** Routes the client's fetch straight into the Hono app (no network). */
function appFetch(app: ReturnType<typeof createApp>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => app.request(String(input), init)) as typeof fetch;
}

describe("typed client", () => {
  it("returns an EnrichedDocument", async () => {
    const client = createEnricherClient({ baseUrl: "http://svc/", fetchImpl: appFetch(createApp({ llm: null })) });
    const doc = await client.enrich(sample("opinion-recreo"), { grado: 7 });
    expect(doc.layout.id).toBe("pancarta");
    expect(doc.meta.grado).toBe(7);
  });

  it("throws EnricherError with the service error code", async () => {
    const client = createEnricherClient({ baseUrl: "http://svc", token: "bad", fetchImpl: appFetch(createApp({ llm: null, token: "good" })) });
    await expect(client.enrich(sample("opinion-recreo"))).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    await expect(client.enrich(sample("opinion-recreo"))).rejects.toBeInstanceOf(EnricherError);
  });
});
