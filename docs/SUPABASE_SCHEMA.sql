-- =====================================================
-- Phantom Messenger - Supabase Schema (Simplified)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MEDIA TABLE (Create FIRST - messages depends on it)
-- =====================================================
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Storage reference
  storage_path TEXT NOT NULL,
  
  -- Encrypted metadata
  encrypted_key TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  
  -- Ownership
  sender_key TEXT NOT NULL,
  recipient_key TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_recipient ON media(recipient_key);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Routing (public keys)
  sender_key TEXT NOT NULL,
  recipient_key TEXT NOT NULL,
  
  -- Encrypted content (server cannot decrypt)
  encrypted_content TEXT NOT NULL,
  
  -- Message metadata
  message_type TEXT DEFAULT 'text',
  
  -- Media reference (optional)
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_key, created_at DESC);

-- =====================================================
-- STORAGE BUCKET (Create manually in Supabase Dashboard)
-- Name: encrypted-media
-- Access: Private
-- =====================================================
