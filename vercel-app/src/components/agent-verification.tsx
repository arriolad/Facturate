"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Check = { id: string | null; status: string; verified?: boolean; message?: string; diagnostic?: string; diagnosticEvidence?: string; screenshot?: string | null; liveUrl?: string | null };
async function checkRequest(path: string, method = "GET", signal?: AbortSignal): Promise<Check> {
  const response = await fetch(path, { method, signal, headers: { "X-Facturate-Request": "1" }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "No pudimos verificar el agente.");
  return data;
}

export function AgentVerification({ disabled, ready, onVerified, portal = false, visual = false }: { disabled: boolean; ready: boolean; onVerified?: () => void; portal?: boolean; visual?: boolean }) {
  const endpoint = visual ? "/api/automation/visual-test" : portal ? "/api/automation/portal-test" : "/api/automation/agent-test";
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [proxyMessage, setProxyMessage] = useState("");
  const pending = useRef(false), reported = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void checkRequest(endpoint, "GET", controller.signal).then(setCheck).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No pudimos consultar la verificación.");
    });
    return () => controller.abort();
  }, [endpoint]);
  const activeId = check?.id && ["pending", "running", "needs_human"].includes(check.status) ? check.id : null;
  useEffect(() => {
    if (!activeId) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void checkRequest(`${endpoint}/${encodeURIComponent(activeId)}`, "GET", controller.signal)
        .then(value => { setCheck(value); setError(""); })
        .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Seguimos esperando el resultado."); })
        .finally(() => { inFlight = false; });
    }, 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [activeId, endpoint]);
  useEffect(() => {
    if (!portal && check?.verified && check.id && reported.current !== check.id) {
      reported.current = check.id;
      onVerified?.();
    }
  }, [check?.verified, check?.id, onVerified, portal]);

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try { setCheck(await checkRequest(endpoint, "POST")); }
    catch (error) { setError(error instanceof Error ? error.message : "No pudimos iniciar la verificación."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function stop() {
    if (!activeId || pending.current) return;
    pending.current = true; setBusy(true);
    try { setCheck(await checkRequest(`${endpoint}/${encodeURIComponent(activeId)}`, "DELETE")); }
    catch (error) { setError(error instanceof Error ? error.message : "No pudimos detener la prueba."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function probeProxy() {
    if(pending.current)return;
    pending.current=true;setBusy(true);setProxyMessage("");
    try{const result=await checkRequest("/api/automation/proxy-test","POST");setProxyMessage(`${result.message} ${result.diagnostic??""}`);}
    catch(error){setProxyMessage(error instanceof Error?error.message:"No pudimos comprobar el proxy.");}
    finally{pending.current=false;setBusy(false);}
  }
  async function testSavedSessions(){
    if(pending.current)return;
    pending.current=true;setBusy(true);setSessionMessage("Probando guardado y restauración con una sesión ficticia…");
    try{const result=await checkRequest("/api/automation/session-test","POST");setSessionMessage(result.message??"Prueba completada.");}
    catch(error){setSessionMessage(error instanceof Error?error.message:"No se pudo verificar el guardado de sesiones.");}
    finally{pending.current=false;setBusy(false);}
  }
  return <section className="space-y-3 rounded-xl border border-[#b8dde1] bg-[#f0fafb] p-4">
    <p className="font-semibold text-[#17636b]">{visual ? "Ticket disponible durante el llenado" : portal ? "Acceso y asistencia de Soriana" : ready || check?.verified ? "Agente de facturación verificado" : "Verificar agente de facturación"}</p>
    <p>{visual ? "Comprueba que la IA conserve el ticket original mientras aparecen nuevos campos en un formulario de dos pasos. Verifica identificadores, correo, pago y un único envío de prueba. Consume uso de OpenAI y Browserless; no emite facturas." : portal ? "Prueba de solo lectura: abre Soriana y comprueba la pausa para iniciar sesión. No utiliza tus datos fiscales ni solicita facturas. Consume uso de Browserless." : "Comprueba que el agente abra un sitio externo, llene y envíe un formulario y lea la confirmación. Usa datos ficticios; consume uso de Browserless y no emite facturas."}</p>
    <Button type="button" variant="outline" disabled={disabled || busy || Boolean(activeId)} onClick={() => void start()}>
      {busy || activeId ? "Verificando agente…" : visual ? "Probar ticket durante el llenado" : portal ? "Comprobar acceso a Soriana" : "Verificar automatización"}
    </Button>
    <p role="status" aria-live="polite">{error || check?.message || (portal ? "Puedes comprobar el acceso sin solicitar una factura." : ready ? "Puedes confirmar un ticket para iniciar su solicitud automática." : "Esta verificación debe pasar antes de habilitar solicitudes automáticas.")}</p>
    {check?.id ? <p className="text-sm text-[#526378]">Estado del proveedor: {check.status}. {check.diagnostic}</p> : null}
    {check?.diagnosticEvidence && !check.verified ? <details><summary>{portal ? "Detalles de la prueba de acceso" : "Detalles de la prueba ficticia"}</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs">{check.diagnosticEvidence}</pre></details> : null}
    {check?.liveUrl ? <Button type="button" variant="outline" onClick={() => window.open(check.liveUrl!, "_blank", "noopener,noreferrer")}>Abrir sesión segura de prueba</Button> : null}
    {portal && activeId ? <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void stop()}>Detener prueba de acceso</Button> : null}
    {portal ? <Button type="button" variant="outline" disabled={disabled||busy||Boolean(activeId)} onClick={()=>void probeProxy()}>Verificar conexión del proxy</Button> : null}
    {!portal&&!visual?<><p>La prueba de sesiones guardadas abre dos navegadores con un dato ficticio, comprueba su restauración y elimina el perfil de prueba. Consume uso de Browserless; no utiliza cuentas personales.</p><Button type="button" variant="outline" disabled={disabled||busy||Boolean(activeId)} onClick={()=>void testSavedSessions()}>Probar sesiones guardadas</Button><p role="status">{sessionMessage}</p></>:null}
    {proxyMessage ? <p role="status" className="whitespace-pre-wrap break-words">{proxyMessage}</p> : null}
    {check?.screenshot ? <img src={`data:image/png;base64,${check.screenshot}`} alt="Captura real de la prueba del agente con datos ficticios" width={960} height={640} className="h-auto w-full rounded-lg border" /> : null}
  </section>;
}
