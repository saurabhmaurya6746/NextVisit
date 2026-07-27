import { apiFetch } from "./auth";

export interface MessageTemplateModel {
  id: string;
  business_id: string;
  campaign_type: string;
  template_name: string;
  message: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateUpdatePayload {
  template_name?: string;
  message?: string;
  is_default?: boolean;
}

export interface MessageTemplatePreviewPayload {
  template_id?: string;
  campaign_type?: string;
  message_override?: string;
  customer_id?: string;
  discount?: number;
  points?: number;
}

export interface MessageTemplatePreviewResponse {
  preview_message: string;
  placeholders_used: Record<string, string>;
}

export interface AutomationRuleModel {
  id: string;
  business_id: string;
  campaign_type: string;
  is_enabled: boolean;
  schedule_type: string;
  run_time: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleUpdatePayload {
  is_enabled?: boolean;
  schedule_type?: string;
  run_time?: string;
}

export interface AutomationRunDetail {
  campaign_type: string;
  campaign_id: string;
  customers_found: number;
  logs_created: number;
  duplicates_skipped: number;
}

export interface AutomationRunResponse {
  business_id: string;
  rules_evaluated: number;
  campaigns_processed: number;
  total_logs_created: number;
  details: AutomationRunDetail[];
}

/**
 * 1. GET /api/v1/message-templates - Fetch all message templates for the business
 */
export async function listMessageTemplatesApi(): Promise<MessageTemplateModel[]> {
  const res = await apiFetch("/api/v1/message-templates");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 2. PUT /api/v1/message-templates/{template_id} - Update a message template
 */
export async function updateMessageTemplateApi(
  id: string,
  payload: MessageTemplateUpdatePayload
): Promise<MessageTemplateModel> {
  const res = await apiFetch(`/api/v1/message-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to update template (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 3. POST /api/v1/message-templates/preview - Preview rendered template with dynamic placeholders
 */
export async function previewMessageTemplateApi(
  payload: MessageTemplatePreviewPayload
): Promise<MessageTemplatePreviewResponse> {
  const res = await apiFetch("/api/v1/message-templates/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to preview template (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 4. GET /api/v1/automation - Get all automation rules for the business
 */
export async function listAutomationRulesApi(): Promise<AutomationRuleModel[]> {
  const res = await apiFetch("/api/v1/automation");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 5. PUT /api/v1/automation/{rule_id} - Update automation rule
 */
export async function updateAutomationRuleApi(
  id: string,
  payload: AutomationRuleUpdatePayload
): Promise<AutomationRuleModel> {
  const res = await apiFetch(`/api/v1/automation/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to update automation rule (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 6. POST /api/v1/automation/run - Manually trigger all enabled automation rules
 */
export async function runAllAutomationApi(): Promise<AutomationRunResponse> {
  const res = await apiFetch("/api/v1/automation/run", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to run automation engine (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 7. POST /api/v1/automation/run/{campaign_type} - Manually trigger automation for a specific campaign type
 */
export async function runAutomationByCampaignTypeApi(
  campaignType: string
): Promise<AutomationRunResponse> {
  const res = await apiFetch(`/api/v1/automation/run/${campaignType}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to run automation for ${campaignType} (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}
