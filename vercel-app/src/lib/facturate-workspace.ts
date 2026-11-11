export type TicketStatus =
  | "Recibido"
  | "Analizando documentos"
  | "Requiere información"
  | "Requiere revisión"
  | "Listo para solicitar"
  | "Solicitud en proceso"
  | "Solicitud enviada"
  | "CAPTCHA pendiente"
  | "Esperando respuesta del comercio"
  | "Factura recibida"
  | "No facturable"
  | "Portal bloqueado"
  | "Error temporal"
  | "Error permanente"
  | "Cancelado";

export function canOpenBillingPortal(status: TicketStatus) {
  return status === "Listo para solicitar" || status === "CAPTCHA pendiente";
}

export function normalizePurchaseDate(value: string) {
  const source = value.trim();
  let year = 0;
  let month = 0;
  let day = 0;
  let match = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = source.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2100 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatPurchaseDateMX(value: string) {
  const normalized = normalizePurchaseDate(value);
  if (!normalized) return value;
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

export type ExtractedField = {
  field: string;
  value: string | null;
  confidence: number;
  source: string | null;
  observation: string;
  requiresReview: boolean;
};

export type WorkflowEvent = { id: string; at: string; state: string; cause: string; action: string };
export type InvoiceFile = { id: string; fileId: string; pdfFileId?: string; uuid: string; total: string; receivedAt: string; validation: string; lifecycle?: string; replacesInvoiceId?: string; satStatus?: string; satCheckedAt?: string; satVerifiedAt?: string; cancellationReportedAt?: string; satResult?: string; revision?: number; allocatedTotal?: string; groupSize?: number; reason?: string };
export type AutomationDiagnosis = { code: string; message: string; recovery: string };
export type AutomationJob = {
  id: string;
  state: "queued" | "running" | "needs_captcha" | "needs_human" | "dispatch_unknown" | "needs_review" | "submitted" | "failed" | "cancelled";
  message: string;
  liveUrl?: string;
  assistanceExpiresAt?: string;
  diagnosis?: AutomationDiagnosis;
  reference?: string;
  evidenceFileId?: string;
  updatedAt: string;
};

export type Ticket = {
  id: string;
  fileName: string;
  fileType: string;
  preview?: string;
  createdAt: string;
  status: TicketStatus;
  merchant: string;
  merchantRfc: string;
  purchaseDate: string;
  total: string;
  ticketNumber: string;
  portalUrl: string;
  cfdiUse: string;
  confidence: number;
  attempts: number;
  folio?: string;
  branch?: string;
  securityCode?: string;
  trackingNumber?: string;
  stationNumber?: string;
  transactionNumber?: string;
  receiptText?: string;
  paymentMethod?: string;
  settlementMethod?: string;
  fileId?: string;
  revision?: number;
  confirmedAt?: string | null;
  extraction?: ExtractedField[];
  events?: WorkflowEvent[];
  invoices?: InvoiceFile[];
  automation?: AutomationJob;
  category?: string;
  requestMode?: string;
};

export type FiscalProfile = {
  rfc: string;
  legalName: string;
  taxRegime: string;
  legalForm: string;
  postalCode: string;
  cfdiUse: string;
  email: string;
  csfFileName: string;
  streetType: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  locality: string;
  municipality: string;
  state: string;
  country: string;
  phone: string;
};

export type LocalFiscalProfile = {
  id: string;
  displayName: string;
  fiscal: FiscalProfile;
  tickets: Ticket[];
  ticketCfdiUse: string;
  ticketPaymentMethod?: string;
  createdAt: string;
  revision?: number;
  confirmedAt?: string | null;
  csfFileId?: string;
  extraction?: ExtractedField[];
};

export type LocalWorkspace = {
  version: 2;
  activeProfileId: string;
  profiles: LocalFiscalProfile[];
};

export const WORKSPACE_STORAGE_KEY = "facturate:workspace:v2";
export const LEGACY_PROFILE_STORAGE_KEY = "facturate:profile";
export const LEGACY_TICKETS_STORAGE_KEY = "facturate:tickets";

export const emptyProfile: FiscalProfile = {
  rfc: "",
  legalName: "",
  taxRegime: "",
  legalForm: "",
  postalCode: "",
  cfdiUse: "",
  email: "",
  csfFileName: "",
  streetType: "",
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  locality: "",
  municipality: "",
  state: "",
  country: "",
  phone: "",
};

const DEFAULT_PROFILE_ID = "perfil-principal";

function safeParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFiscal(value: unknown): FiscalProfile {
  if (!isRecord(value)) return { ...emptyProfile };

  const normalized = { ...emptyProfile };
  for (const key of Object.keys(normalized) as Array<keyof FiscalProfile>) {
    const candidate = value[key];
    if (typeof candidate === "string") normalized[key] = candidate;
  }
  return normalized;
}

function normalizeTickets(value: unknown): Ticket[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((ticket) => ({ ...ticket, preview: undefined })) as Ticket[];
}

function normalizeLocalProfile(value: unknown, index: number): LocalFiscalProfile | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) return null;

  const fiscal = normalizeFiscal(value.fiscal);
  const displayName =
    typeof value.displayName === "string" && value.displayName.trim()
      ? value.displayName.trim()
      : fiscal.legalName.trim() || `Perfil ${index + 1}`;

  return {
    id: value.id,
    displayName,
    fiscal,
    tickets: normalizeTickets(value.tickets),
    ticketCfdiUse:
      typeof value.ticketCfdiUse === "string" && value.ticketCfdiUse
        ? value.ticketCfdiUse
        : fiscal.cfdiUse || emptyProfile.cfdiUse,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
  };
}

export function createLocalProfile(
  displayName: string,
  id = globalThis.crypto.randomUUID(),
): LocalFiscalProfile {
  return {
    id,
    displayName: displayName.trim() || "Nuevo perfil",
    fiscal: { ...emptyProfile },
    tickets: [],
    ticketCfdiUse: emptyProfile.cfdiUse,
    createdAt: new Date().toISOString(),
  };
}

export function createInitialWorkspace(): LocalWorkspace {
  return {
    version: 2,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        displayName: "Mi perfil",
        fiscal: { ...emptyProfile },
        tickets: [],
        ticketCfdiUse: emptyProfile.cfdiUse,
        createdAt: "",
      },
    ],
  };
}

export function loadLocalWorkspace(
  workspaceValue: string | null,
  legacyProfileValue: string | null,
  legacyTicketsValue: string | null,
): LocalWorkspace {
  const stored = safeParse(workspaceValue);
  if (isRecord(stored) && Array.isArray(stored.profiles)) {
    const profiles = stored.profiles
      .map((profile, index) => normalizeLocalProfile(profile, index))
      .filter((profile): profile is LocalFiscalProfile => Boolean(profile));

    if (profiles.length) {
      const requestedActiveId =
        typeof stored.activeProfileId === "string" ? stored.activeProfileId : "";
      const activeProfileId = profiles.some((profile) => profile.id === requestedActiveId)
        ? requestedActiveId
        : profiles[0].id;

      return { version: 2, activeProfileId, profiles };
    }
  }

  const legacyFiscal = normalizeFiscal(safeParse(legacyProfileValue));
  const legacyTickets = normalizeTickets(safeParse(legacyTicketsValue));
  const displayName = legacyFiscal.legalName.trim() || "Mi perfil";

  return {
    version: 2,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        displayName,
        fiscal: legacyFiscal,
        tickets: legacyTickets,
        ticketCfdiUse: legacyFiscal.cfdiUse || emptyProfile.cfdiUse,
        createdAt: "",
      },
    ],
  };
}

export function serializeLocalWorkspace(workspace: LocalWorkspace): string {
  return JSON.stringify({
    ...workspace,
    profiles: workspace.profiles.map((profile) => ({
      ...profile,
      tickets: profile.tickets.map((ticket) => ({ ...ticket, preview: undefined })),
    })),
  });
}
