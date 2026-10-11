import type { MessageKey } from "@/lib/i18n/messages";

// Maps known English API error messages to catalog keys for display only.
// Response bodies and status codes are unchanged; unknown messages are shown as returned.
const API_ERROR_KEYS = {
  "Authentication required.": "apiError.authRequired",
  "Select an active workspace.": "apiError.selectWorkspace",
  "Invalid request origin.": "apiError.invalidOrigin",
  "Workspace authorization changed. Refresh and try again.": "apiError.authChanged",
  "Invalid request body.": "apiError.invalidBody",
  "Request body must be valid JSON.": "apiError.invalidJson",
  "Validation failed": "apiError.validationFailed",
  "Compliance write permission required.": "apiError.complianceWrite",
  "Compliance access denied.": "apiError.complianceDenied",
  "Compliance obligation not found.": "apiError.complianceNotFound",
  "Client portal access not found.": "apiError.portalNotFound",
  "Client portal access has expired or been revoked.": "apiError.portalExpired",
  "Operational action not found.": "apiError.actionNotFound",
  "Action changed since it was loaded. Refresh before retrying.": "apiError.actionChanged",
  "Market-entry pathway changed. Refresh before retrying.": "apiError.pathwayChanged",
  "Market-entry pathway not found.": "apiError.pathwayNotFound",
  "Client not found.": "apiError.clientNotFound",
  "Professional review permission required.": "apiError.reviewPermission",
  "Formation write permission required.": "apiError.formationWrite",
  "Engagement not found.": "apiError.engagementNotFound",
  "Engagement write permission required.": "apiError.engagementWrite",
  "Document write permission required.": "apiError.documentWrite",
  "Client write permission required.": "apiError.clientWrite",
  "Workspace access denied.": "apiError.workspaceDenied",
  "Dossier changed. Refresh before retrying.": "apiError.dossierChanged",
  "Document not found.": "apiError.documentNotFound",
  "Cross-border dossier not found.": "apiError.dossierNotFound",
  "Business profile not found in this workspace.": "apiError.profileNotFound",
  "Document type or file signature is not allowed.": "apiError.documentType",
  "Document exceeds the 25 MiB limit.": "apiError.documentSize",
  "Document checksum does not match uploaded bytes.": "apiError.documentChecksum",
  "Dossier changed. Refresh and retry.": "apiError.dossierChanged",
} as const satisfies Record<string, MessageKey>;

export function localizeApiError(t: (key: MessageKey) => string, message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  const key = (API_ERROR_KEYS as Record<string, MessageKey>)[message.trim()];
  return key ? t(key) : message;
}

export const KNOWN_API_ERROR_MESSAGES = Object.keys(API_ERROR_KEYS);
