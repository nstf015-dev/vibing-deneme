-- ============================================
-- 1. POST BEĞENİLERİ VE YORUMLARI
-- ============================================

-- POST BEĞENİLERİ (Likes)
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_readable" ON post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON post_likes;

CREATE POLICY "post_likes_readable" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "post_likes_insert" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_likes_delete" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- POST YORUMLARI (Comments)
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_readable" ON post_comments;
DROP POLICY IF EXISTS "post_comments_insert" ON post_comments;
DROP POLICY IF EXISTS "post_comments_delete" ON post_comments;

CREATE POLICY "post_comments_readable" ON post_comments
  FOR SELECT USING (true);

CREATE POLICY "post_comments_insert" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_delete" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- POST PAYLAŞIMLARI (Shares)
CREATE TABLE IF NOT EXISTS post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_shares_readable" ON post_shares;
DROP POLICY IF EXISTS "post_shares_insert" ON post_shares;

CREATE POLICY "post_shares_readable" ON post_shares
  FOR SELECT USING (true);

CREATE POLICY "post_shares_insert" ON post_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);

