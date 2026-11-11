"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Evidence = { title: string; testedAt: string; screenshot: string };

export function BrowserConnectionTest({ disabled }: { disabled: boolean }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [evidence, setEvidence] = useState<Evidence | null>(null);

  async function testConnection() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    setEvidence(null);
    try {
      const response = await fetch("/api/automation/connection-test", {
        method: "POST", headers: { "X-Facturate-Request": "1" }, cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "No se pudo completar la prueba.");
      setEvidence(result);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la prueba.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="space-y-3 rounded-xl border border-[#dce7f0] p-4">
    <p className="font-semibold text-[#274b68]">Conexión con portales</p>
    <p>Esta prueba llena y envía un formulario de prueba dentro del navegador. No usa tus documentos ni solicita facturas. Consume una sesión de navegador.</p>
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void testConnection()}>
      {busy ? "Probando conexión…" : "Probar conexión con navegador"}
    </Button>
    <p role="status" aria-live="polite">{busy ? "Abriendo el formulario de prueba. Puede tardar hasta 35 segundos." : message}</p>
    {evidence ? <div className="space-y-2">
      <p>Página verificada: {evidence.title}. Fecha: {new Date(evidence.testedAt).toLocaleString("es-MX")}.</p>
      <img src={`data:image/png;base64,${evidence.screenshot}`} alt="Captura del formulario de prueba llenado y enviado por el navegador remoto" width={960} height={640} className="h-auto w-full rounded-lg border border-[#dce7f0]" />
      <p>La conexión funciona. La solicitud de facturas requiere configurar y probar el portal del comercio.</p>
    </div> : null}
  </div>;
}
