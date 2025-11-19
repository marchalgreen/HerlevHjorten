-- Migration: Add page_views table for analytics tracking
-- Tracks page views for marketing site and demo tenant to measure interest and cold-call effectiveness

CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL, -- 'marketing', 'demo', or specific tenant
  path TEXT NOT NULL, -- e.g., '/', '/#/check-in', '/#/coach'
  referrer TEXT, -- where user came from
  user_agent TEXT, -- browser info
  ip_address INET, -- can be anonymized later if needed
  utm_source TEXT, -- e.g., 'email', 'linkedin', 'direct'
  utm_medium TEXT, -- e.g., 'cold-call', 'social', 'organic'
  utm_campaign TEXT, -- e.g., 'q1-2024-outreach'
  session_id TEXT NOT NULL, -- for identifying unique sessions
  is_unique_visitor BOOLEAN DEFAULT FALSE, -- first visit from this session
  is_admin_view BOOLEAN DEFAULT FALSE, -- true if viewed by admin/sysadmin user
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_id ON page_views(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON page_views(utm_source);
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_created ON page_views(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_is_admin ON page_views(is_admin_view);

-- Add comment to table
COMMENT ON TABLE page_views IS 'Tracks page views for analytics - marketing site and demo tenant visits';

