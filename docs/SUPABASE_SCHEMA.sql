-- =====================================================
-- Phantom Messenger - Supabase Schema
-- HYBRID MODE: Messages persist, Media is ephemeral
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MESSAGES TABLE (Persistent)
-- Stores encrypted message metadata - server can't read content
-- =====================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Routing (public keys, not user IDs)
  sender_key TEXT NOT NULL,
  recipient_key TEXT NOT NULL,
  
  -- Encrypted content (server cannot decrypt)
  encrypted_content TEXT NOT NULL,  -- Base64 encoded encrypted blob
  
  -- Message metadata
  message_type TEXT DEFAULT 'text',  -- 'text', 'media', 'file'
  
  -- Media reference (if message has attachment)
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for efficient queries
  CONSTRAINT messages_sender_key_idx UNIQUE (id, sender_key),
  CONSTRAINT messages_recipient_key_idx UNIQUE (id, recipient_key)
);

-- Indexes for sync queries
CREATE INDEX idx_messages_recipient ON messages(recipient_key, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_key, created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(
  LEAST(sender_key, recipient_key), 
  GREATEST(sender_key, recipient_key), 
  created_at DESC
);

-- =====================================================
-- MEDIA TABLE (Ephemeral)
-- Deletes after both users download
-- =====================================================
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Storage reference
  storage_path TEXT NOT NULL,  -- Path in Supabase Storage
  
  -- Encrypted metadata (client encrypts these)
  encrypted_key TEXT NOT NULL,     -- AES key encrypted with recipient's public key
  file_size BIGINT NOT NULL,
  mime_type TEXT,                  -- 'image/jpeg', 'video/mp4', etc.
  
  -- Download tracking
  sender_key TEXT NOT NULL,
  recipient_key TEXT NOT NULL,
  sender_downloaded BOOLEAN DEFAULT TRUE,    -- Sender already has it
  recipient_downloaded BOOLEAN DEFAULT FALSE,
  
  -- Auto-expire fallback (7 days even if not downloaded)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_recipient ON media(recipient_key, recipient_downloaded);
CREATE INDEX idx_media_expires ON media(expires_at) WHERE recipient_downloaded = FALSE;

-- =====================================================
-- FUNCTION: Delete media after both download
-- =====================================================
CREATE OR REPLACE FUNCTION delete_media_after_download()
RETURNS TRIGGER AS $$
BEGIN
  -- If both parties have downloaded, delete the record
  -- The storage file will be cleaned up by a separate job
  IF NEW.sender_downloaded = TRUE AND NEW.recipient_downloaded = TRUE THEN
    -- Mark for deletion (actual file cleanup happens via cron/edge function)
    DELETE FROM media WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_delete_media
  AFTER UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION delete_media_after_download();

-- =====================================================
-- FUNCTION: Clean up expired media
-- Run this via Supabase cron job
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_media()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM media 
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only access their own messages
-- =====================================================

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read messages where they are sender or recipient
CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT
  USING (
    sender_key = current_setting('app.current_user_key', TRUE)
    OR recipient_key = current_setting('app.current_user_key', TRUE)
  );

-- Policy: Users can insert messages as sender
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (sender_key = current_setting('app.current_user_key', TRUE));

-- Policy: Users can read their media
CREATE POLICY "Users can read own media" ON media
  FOR SELECT
  USING (
    sender_key = current_setting('app.current_user_key', TRUE)
    OR recipient_key = current_setting('app.current_user_key', TRUE)
  );

-- Policy: Users can update download status for their media
CREATE POLICY "Users can mark media downloaded" ON media
  FOR UPDATE
  USING (recipient_key = current_setting('app.current_user_key', TRUE))
  WITH CHECK (recipient_key = current_setting('app.current_user_key', TRUE));

-- =====================================================
-- STORAGE BUCKET
-- Create via Supabase Dashboard or CLI:
-- supabase storage create encrypted-media --public=false
-- =====================================================

-- Storage policies (set in Supabase Dashboard):
-- 1. Authenticated users can upload to: encrypted-media/{sender_key}/*
-- 2. Users can download from: encrypted-media/*/{media_id} if they are sender or recipient

-- =====================================================
-- VIEWS for easy querying
-- =====================================================

-- Conversation list with last message
CREATE VIEW conversation_list AS
SELECT DISTINCT ON (conversation_key)
  CASE 
    WHEN sender_key < recipient_key THEN sender_key || ':' || recipient_key
    ELSE recipient_key || ':' || sender_key
  END as conversation_key,
  sender_key,
  recipient_key,
  encrypted_content,
  message_type,
  created_at as last_message_at
FROM messages
ORDER BY conversation_key, created_at DESC;
