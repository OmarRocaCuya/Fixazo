import { redirect } from "next/navigation";

// Legacy links no longer introduce an onboarding wall or grant permissions.
// Capture and external processing still need explicit controls in the session.
export default function LegacyConsentPage() {
  redirect("/chat");
}
