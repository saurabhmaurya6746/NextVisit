-- Phase 8: Durable Sync Engine Outbox enhancements
-- Adds next_retry_at for bounded exponential backoff with jitter,
-- updated_at for tracking state transitions, and last_http_status for error diagnostics.

ALTER TABLE client_outbox ADD COLUMN next_retry_at TEXT;
ALTER TABLE client_outbox ADD COLUMN updated_at TEXT;
ALTER TABLE client_outbox ADD COLUMN last_http_status INTEGER;

CREATE INDEX IF NOT EXISTS idx_client_outbox_retry
    ON client_outbox(business_id, status, next_retry_at);
