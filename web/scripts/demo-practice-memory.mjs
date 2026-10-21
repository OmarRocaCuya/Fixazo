// Local HTTP fixture for the documented browser demo. No external service calls.
import { createServer } from "node:http";
const notes = new Map();
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString()); }
  catch { response.writeHead(400).end(); return; }
  if (request.headers.authorization !== "Bearer fixture-key") { response.writeHead(401).end(); return; }
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/v1/memories/ingest/quick") {
    const prior = notes.get(input.user_id) ?? [];
    prior.push({ id: String(prior.length + 1), content: input.conversation, metadata: input.metadata, source_site: input.source_site });
    notes.set(input.user_id, prior);
    response.end(JSON.stringify({ memories_stored: 1, stored_memory_ids: [String(prior.length)] }));
  } else if (request.url === "/v1/memories/search/fast") {
    response.end(JSON.stringify({ memories: notes.get(input.user_id) ?? [] }));
  } else if (request.url === "/v1/memories/reset-source") {
    notes.delete(input.user_id); response.end(JSON.stringify({ success: true, deleted_memories: 1, deleted_episodes: 0, deleted_documents: 0 }));
  } else { response.writeHead(404).end(); }
});
server.listen(4811, "127.0.0.1", () => console.log("Local Atomic Memory HTTP fixture: http://127.0.0.1:4811"));
