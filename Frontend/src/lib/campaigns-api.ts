import { apiFetch } from "./auth";

export interface CampaignModel {
  id: string;
  business_id: string;
  name: string;
  campaign_type: "BIRTHDAY" | "ANNIVERSARY" | "WELCOME" | "RECOVERY" | "FESTIVAL" | "VIP" | "CUSTOM" | string;
  target_segment:
    | "ALL_CUSTOMERS"
    | "VIP_CUSTOMERS"
    | "NEW_CUSTOMERS"
    | "INACTIVE_15"
    | "INACTIVE_30"
    | "INACTIVE_60"
    | "INACTIVE_90"
    | "BIRTHDAY_TODAY"
    | "ANNIVERSARY_TODAY"
    | string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignCreatePayload {
  name: string;
  campaign_type: string;
  target_segment: string;
  title: string;
  message: string;
  is_active?: boolean;
}

export interface CampaignUpdatePayload {
  name?: string;
  campaign_type?: string;
  target_segment?: string;
  title?: string;
  message?: string;
  is_active?: boolean;
}

export interface CampaignGenerateAudienceResponse {
  campaign_id: string;
  customers_found: number;
  logs_created: number;
}

export interface CampaignLogItem {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  message: string;
  status: "PENDING" | "SENT" | "FAILED" | string;
  scheduled_for: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

function parseErrorDetail(errData: any, fallback: string): string {
  if (!errData) return fallback;
  if (typeof errData.detail === "string") return errData.detail;
  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    return errData.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
  }
  if (errData.message && typeof errData.message === "string") return errData.message;
  return fallback;
}

/**
 * 1. GET /api/v1/campaigns - List all campaigns
 */
export async function listCampaignsApi(): Promise<CampaignModel[]> {
  const res = await apiFetch("/api/v1/campaigns");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `HTTP ${res.status}`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 2. POST /api/v1/campaigns - Create a new campaign
 */
export async function createCampaignApi(payload: CampaignCreatePayload): Promise<CampaignModel> {
  const res = await apiFetch("/api/v1/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to create campaign (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 3. GET /api/v1/campaigns/{campaign_id} - Fetch single campaign
 */
export async function getCampaignApi(campaignId: string): Promise<CampaignModel> {
  const res = await apiFetch(`/api/v1/campaigns/${campaignId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to fetch campaign (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 4. PUT /api/v1/campaigns/{campaign_id} - Edit an existing campaign
 */
export async function updateCampaignApi(
  campaignId: string,
  payload: CampaignUpdatePayload
): Promise<CampaignModel> {
  const res = await apiFetch(`/api/v1/campaigns/${campaignId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to update campaign (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 5. DELETE /api/v1/campaigns/{campaign_id} - Delete a campaign
 */
export async function deleteCampaignApi(campaignId: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/campaigns/${campaignId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to delete campaign (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 6. POST /api/v1/campaigns/{campaign_id}/generate - Trigger audience log generation
 */
export async function generateCampaignAudienceApi(
  campaignId: string
): Promise<CampaignGenerateAudienceResponse> {
  const res = await apiFetch(`/api/v1/campaigns/${campaignId}/generate`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to generate campaign audience (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Execution Queue & Logs APIs
 */
export async function listPendingLogsApi(): Promise<CampaignLogItem[]> {
  const res = await apiFetch("/api/v1/campaign-logs/pending");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `HTTP ${res.status}`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

export async function listSentLogsApi(): Promise<CampaignLogItem[]> {
  const res = await apiFetch("/api/v1/campaign-logs/sent");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `HTTP ${res.status}`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

export async function listFailedLogsApi(): Promise<CampaignLogItem[]> {
  const res = await apiFetch("/api/v1/campaign-logs/failed");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `HTTP ${res.status}`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

export async function markLogSentApi(logId: string): Promise<CampaignLogItem> {
  const res = await apiFetch(`/api/v1/campaign-logs/${logId}/mark-sent`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to mark log as SENT (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

export async function markLogFailedApi(
  logId: string,
  reason?: string
): Promise<CampaignLogItem> {
  const res = await apiFetch(`/api/v1/campaign-logs/${logId}/mark-failed`, {
    method: "POST",
    body: JSON.stringify({ failure_reason: reason }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(parseErrorDetail(errData, `Failed to mark log as FAILED (HTTP ${res.status})`));
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

export interface GenerateCampaignAiMessageParams {
  campaign_name?: string;
  campaign_type: string;
  target_segment?: string;
  title: string;
  discount?: string;
  message_content?: string;
  business_name?: string;
  business_type?: string;
  business_address?: string;
  business_phone?: string;
  language?: string;
  tone?: string;
  length?: string;
}

/**
 * Gemini AI Message Generator Utility (Routed through Backend FastAPI)
 */
export async function generateCampaignMessageWithGemini(
  params: GenerateCampaignAiMessageParams | string,
  legacyTitle?: string,
  legacyDiscount?: string
): Promise<string> {
  const bodyData =
    typeof params === "string"
      ? {
          campaign_type: params,
          title: legacyTitle || "",
          discount: legacyDiscount,
        }
      : params;

  const res = await apiFetch("/api/v1/campaigns/generate-ai-message", {
    method: "POST",
    body: JSON.stringify(bodyData),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const detailMsg = parseErrorDetail(errData, `Failed to generate AI message (HTTP ${res.status})`);
    console.error("AI campaign generation failed", {
      error: detailMsg,
      payload: bodyData,
      responseStatus: res.status,
    });
    const err = new Error(detailMsg);
    (err as any).status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.generated_message;
}
