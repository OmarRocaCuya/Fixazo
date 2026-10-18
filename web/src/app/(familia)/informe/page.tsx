"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/useStore";
import { ReportView } from "@/components/report/ReportView";

const Skeleton = () => <div className="skeleton" style={{ height: 480 }} aria-label="Preparando el informe…" />;

export default function ReportPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ReportInner />
    </Suspense>
  );
}

function ReportInner() {
  const store = useStore();
  const params = useSearchParams();
  if (!store) return <Skeleton />;
  const reports = [...store.listReports()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const id = params.get("id");
  const report = (id && reports.find((r) => r.id === id)) || reports[0];

  if (!report)
    return (
      <div className="page">
        <h1>Sesiones</h1>
        <div className="card stack">
          <p>Todavía no hay sesiones. Arma una misión en el chat y hazla con tu hijo.</p>
          <Link className="btn" href="/chat" style={{ justifySelf: "start" }}>
            Ir al chat
          </Link>
        </div>
      </div>
    );

  return (
    <div className="stack" style={{ gap: 24 }}>
      {reports.length > 1 && (
        <nav className="page" aria-label="Otras sesiones">
          <div className="chips">
            {reports.slice(0, 8).map((r) => (
              <Link key={r.id} className={`chip${r.id === report.id ? " selected" : ""}`} href={`/informe?id=${encodeURIComponent(r.id)}`} aria-current={r.id === report.id ? "page" : undefined}>
                {new Date(r.createdAt).toLocaleDateString("es-PE", { day: "numeric", month: "short" })} · {r.missionTitle}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <ReportView key={report.id} report={report} />
    </div>
  );
}
