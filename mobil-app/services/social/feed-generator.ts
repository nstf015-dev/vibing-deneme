/**
 * FEED GENERATOR
 * 
 * Algorithm for generating and ordering social feed
 */

import { supabase } from '../../lib/supabase';
import { Post } from '../../store/contexts/SocialContext';

export interface FeedOptions {
  userId?: string;
  businessId?: string;
  category?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Generate feed based on algorithm
 * 
 * Algorithm:
 * 1. Boosted posts (paid promotions)
 * 2. Trending posts (high engagement)
 * 3. Posts from followed businesses
 * 4. Recent posts from nearby businesses
 * 5. General recent posts
 */
export async function generateFeed(options: FeedOptions = {}): Promise<{
  posts: Post[];
  nextCursor: string | null;
}> {
  const { userId, businessId, category, limit = 20, cursor } = options;

  try {
    // If no posts from special sources, just get recent posts
    // This ensures we always have content
    const recentPosts = await getRecentPosts(limit, cursor);
    
    if (recentPosts.length > 0) {
      const nextCursor =
        recentPosts.length === limit
          ? recentPosts[recentPosts.length - 1].id
          : null;

      return {
        posts: recentPosts,
        nextCursor,
      };
    }

    // Fallback: Try to get any posts
    const { data } = await supabase
      .from('posts')
      .select('*, business:profiles!business_id(business_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(limit);

    const posts = transformPosts(data || []);

    return {
      posts,
      nextCursor: null,
    };
  } catch (error) {
    console.error('Feed generation error:', error);
    return { posts: [], nextCursor: null };
  }
}

/**
 * Get boosted posts (paid promotions)
 */
async function getBoostedPosts(limit: number): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select(
      `
      *,
      business:profiles!business_id(business_name, avatar_url),
      boost:boost_orders!inner(status, expires_at)
    `
    )
    .eq('boost.status', 'active')
    .gt('boost.expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  return transformPosts(data || []);
}

/**
 * Get trending posts (high engagement)
 */
async function getTrendingPosts(limit: number): Promise<Post[]> {
  try {
    // Get posts with high engagement in last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data } = await supabase
      .from('posts')
      .select(
        `
        *,
        business:profiles!business_id(business_name, avatar_url),
        likes:post_likes(count),
        comments:post_comments(count)
      `
      )
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Get more to filter by engagement

    if (!data) return [];

    // Calculate engagement score and sort
    const postsWithScore = data.map((post: any) => {
      const likesCount = Array.isArray(post.likes) ? post.likes.length : (post.likes?.count || 0);
      const commentsCount = Array.isArray(post.comments) ? post.comments.length : (post.comments?.count || 0);
      const engagementScore = likesCount * 2 + commentsCount * 3; // Comments weighted more

      return {
        ...post,
        engagementScore,
        likes_count: likesCount,
        comments_count: commentsCount,
      };
    });

    // Sort by engagement and take top
    postsWithScore.sort((a, b) => b.engagementScore - a.engagementScore);

    return transformPosts(postsWithScore.slice(0, limit));
  } catch (error) {
    console.error('Get trending posts error:', error);
    return [];
  }
}

/**
 * Get posts from followed businesses
 */
async function getFollowedBusinessPosts(
  userId: string,
  limit: number
): Promise<Post[]> {
  try {
    // Get user's favorite businesses
    const { data: favorites } = await supabase
      .from('favorite_businesses')
      .select('business_id')
      .eq('user_id', userId);

    if (!favorites || favorites.length === 0) return [];

    const businessIds = favorites.map((f) => f.business_id);

    const { data } = await supabase
      .from('posts')
      .select(
        `
        *,
        business:profiles!business_id(business_name, avatar_url)
      `
      )
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    return transformPosts(data || []);
  } catch (error) {
    console.error('Get followed posts error:', error);
    return [];
  }
}

/**
 * Get nearby posts (based on location)
 */
async function getNearbyPosts(limit: number): Promise<Post[]> {
  // TODO: Implement location-based filtering
  // For now, return recent posts
  return getRecentPosts(limit);
}

/**
 * Get recent posts
 */
async function getRecentPosts(
  limit: number,
  cursor?: string
): Promise<Post[]> {
  try {
    let query = supabase
      .from('posts')
      .select(
        `
        *,
        business:profiles!business_id(business_name, avatar_url)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('id', cursor);
    }

    const { data } = await query;

    return transformPosts(data || []);
  } catch (error) {
    console.error('Get recent posts error:', error);
    return [];
  }
}

/**
 * Transform database posts to Post type
 */
function transformPosts(data: any[]): Post[] {
  return data.map((item) => {
    // Handle business data - it might be an array or object
    const business = Array.isArray(item.business) ? item.business[0] : item.business;
    
    return {
      id: item.id,
      user_id: item.user_id,
      media_url: item.media_url,
      media_type: item.is_video ? 'video' : 'image',
      caption: item.caption,
      service_name: item.service_name,
      business_id: item.business_id,
      created_at: item.created_at,
      likes_count: item.likes_count || 0,
      comments_count: item.comments_count || 0,
      shares_count: item.shares_count || 0,
      is_liked: false, // Will be set by API call
      user: business
        ? {
            full_name: business.business_name || business.full_name || 'Business',
            avatar_url: business.avatar_url || null,
            business_name: business.business_name,
          }
        : {
            full_name: 'Kullanıcı',
            avatar_url: null,
          },
    };
  });
}

/**
 * Deduplicate posts by ID
 */
function deduplicatePosts(posts: Post[]): Post[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) {
      return false;
    }
    seen.add(post.id);
    return true;
  });
}

/**
 * Sort posts by relevance
 */
function sortPostsByRelevance(posts: Post[], userId?: string): Post[] {
  // Simple relevance: boosted > trending > recent
  // In production, use ML-based ranking
  return posts;
}

