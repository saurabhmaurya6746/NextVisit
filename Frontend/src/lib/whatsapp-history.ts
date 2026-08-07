import { useEffect, useState } from "react";
import { apiFetch } from "./auth";

export interface CampaignHistoryItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  business_id: string;
  business_name: string;
  business_type: string;
  campaign_id?: string | null;
  campaign_name: string;
  campaign_type: string;
  message: string;
  message_preview: string;
  coupon_code?: string | null;
  status: string;
  sent_by: string;
  sent_by_role?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export interface PaginatedCampaignHistoryResponse {
  items: CampaignHistoryItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export function logWhatsApp(entry: any) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("growthos:wa-changed"));
  }
}

export async function fetchBackendCampaignHistoryApi(params: {
  page?: number;
  limit?: number;
  search?: string;
  campaign_type?: string;
  status?: string;
  date_range?: string;
  sort?: string;
}): Promise<PaginatedCampaignHistoryResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.campaign_type && params.campaign_type !== "all") query.set("campaign_type", params.campaign_type);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.date_range && params.date_range !== "all") query.set("date_range", params.date_range);
  if (params.sort) query.set("sort", params.sort);

  const res = await apiFetch(`/api/v1/campaign-logs/history?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch WhatsApp history (HTTP ${res.status})`);
  }
  return res.json();
}