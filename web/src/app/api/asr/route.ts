import { getVoicePolicyStatus } from "@/lib/server/voice-policy";
import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json({
    providers: { deepgram: getVoicePolicyStatus("deepgram") },
    model: "nova-3",
    languages: ["es"],
    wordTimings: true,
    limitations: ["not-validated-for-children", "no-quechua", "no-emotion-inference", "no-speaker-identification"],
  }, { headers: { "Cache-Control": "no-store" } });
}
