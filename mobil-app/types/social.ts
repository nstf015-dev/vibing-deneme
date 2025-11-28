/**
 * SOCIAL DOMAIN TYPES
 */

export interface Post {
  id: string;
  user_id: string;
  business_id: string | null;
  media_url: string;
  is_video: boolean;
  caption: string | null;
  service_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface PostShare {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostServiceLink {
  id: string;
  post_id: string;
  service_id: string;
  staff_id: string | null;
  business_id: string;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  post_id: string;
  added_at: string;
}

