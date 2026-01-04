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

-- =====================================================
-- USER PROFILES (Links Supabase Auth to app identity)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  public_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_public_key ON profiles(public_key);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- =====================================================
-- INVITATIONS (For connecting users)
-- =====================================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_public_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_creator ON invitations(creator_id);

-- RLS for invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own invitations"
  ON invitations FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can view invitations by code"
  ON invitations FOR SELECT
  USING (true);

CREATE POLICY "Users can update unused invitations"
  ON invitations FOR UPDATE
  USING (used_by IS NULL OR auth.uid() = creator_id);

-- =====================================================
-- CONNECTIONS (User relationships)
-- =====================================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  established_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_connections_user_a ON connections(user_a);
CREATE INDEX IF NOT EXISTS idx_connections_user_b ON connections(user_b);

-- RLS for connections
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can create connections"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
