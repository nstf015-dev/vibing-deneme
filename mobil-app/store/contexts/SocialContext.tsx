/**
 * SOCIAL CONTEXT
 * React Context API for social feed state
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Post {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  service_name: string | null;
  business_id: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked: boolean;
  user?: {
    full_name: string;
    avatar_url: string | null;
    business_name?: string;
  };
  service_link?: {
    service_id: string;
    staff_id: string | null;
  };
}

interface SocialContextType {
  feed: Post[];
  currentIndex: number;
  loading: boolean;
  hasMore: boolean;
  cursor: string | null;
  setFeed: (posts: Post[]) => void;
  appendFeed: (posts: Post[]) => void;
  setCurrentIndex: (index: number) => void;
  nextPost: () => void;
  previousPost: () => void;
  toggleLike: (postId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setCursor: (cursor: string | null) => void;
  resetFeed: () => void;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
  const [feed, setFeedState] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const setFeed = useCallback((posts: Post[]) => {
    setFeedState(posts);
    setCurrentIndex(0);
  }, []);

  const appendFeed = useCallback((posts: Post[]) => {
    setFeedState((prev) => [...prev, ...posts]);
  }, []);

  const nextPost = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < feed.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [feed.length]);

  const previousPost = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const toggleLike = useCallback(async (postId: string) => {
    setFeedState((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !post.is_liked,
            likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1,
          };
        }
        return post;
      })
    );
  }, []);

  const resetFeed = useCallback(() => {
    setFeedState([]);
    setCurrentIndex(0);
    setLoading(false);
    setHasMore(true);
    setCursor(null);
  }, []);

  return (
    <SocialContext.Provider
      value={{
        feed,
        currentIndex,
        loading,
        hasMore,
        cursor,
        setFeed,
        appendFeed,
        setCurrentIndex,
        nextPost,
        previousPost,
        toggleLike,
        setLoading,
        setHasMore,
        setCursor,
        resetFeed,
      }}>
      {children}
    </SocialContext.Provider>
  );
}

export function useSocialStore() {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error('useSocialStore must be used within SocialProvider');
  }
  return context;
}

