import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { generateFeed } from '../../services/social/feed-generator';
import { initializeBookingFromPost } from '../../services/social/book-this-look';
import { useSocialStore } from '../../store/contexts/SocialContext';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { feed, setFeed, appendFeed, currentIndex, setCurrentIndex, toggleLike, setLoading, setHasMore, setCursor, resetFeed, cursor } = useSocialStore();
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState<{ visible: boolean; postId: string | null }>({ visible: false, postId: null });
  const [newComment, setNewComment] = useState('');
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [viewableItems, setViewableItems] = useState<ViewToken[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<Record<string, any>>({});

  useEffect(() => {
    fetchUserAndPosts();
  }, []);

  const fetchUserAndPosts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      await loadFeed();
    } catch (error) {
      console.error('Initial load error:', error);
    }
  }, []);

  const loadFeed = useCallback(async (cursor?: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { posts, nextCursor } = await generateFeed({
        userId: user?.id,
        limit: 10,
        cursor,
      });

      // Enrich posts with user like status and comments
      const enriched = await Promise.all(posts.map(async (post) => {
        const [userLikeRes, commentsRes] = await Promise.all([
          user ? supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).single() : Promise.resolve({ data: null }),
          supabase.from('post_comments').select('*, profiles(full_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: false }).limit(3),
        ]);

        return {
          ...post,
          is_liked: Boolean(userLikeRes.data),
          recent_comments: commentsRes.data || [],
        };
      }));

      if (cursor) {
        appendFeed(enriched);
      } else {
        setFeed(enriched);
      }

      setHasMore(!!nextCursor);
      setCursor(nextCursor);
    } catch (error) {
      console.error('Feed yükleme hatası:', error);
      Alert.alert('Hata', 'Feed yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setFeed, appendFeed, setLoading, setHasMore, setCursor]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    resetFeed();
    loadFeed();
  }, [loadFeed, resetFeed]);

  const onEndReached = useCallback(() => {
    if (!feed.length || refreshing) return;
    if (cursor) {
      loadFeed(cursor);
    }
  }, [feed.length, refreshing, loadFeed, cursor]);

  const handleBookThisLook = useCallback(async (postId: string) => {
    try {
      const success = await initializeBookingFromPost(postId, router);
      if (!success) {
        Alert.alert('Hata', 'Bu gönderi için rezervasyon yapılamıyor.');
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Rezervasyon başlatılamadı.');
    }
  }, [router]);

  const handleToggleLike = useCallback(async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('Giriş Gerekli', 'Beğenmek için lütfen giriş yapın.');
      return;
    }

    await toggleLike(postId);

    // API call
    try {
      const { data: existing } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserId)
        .single();

      if (existing) {
        await supabase.from('post_likes').delete().eq('id', existing.id);
      } else {
        await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: currentUserId,
        });
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  }, [currentUserId, toggleLike]);

  const handleAddComment = useCallback(async () => {
    if (!commentModal.postId || !currentUserId || !newComment.trim()) return;

    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: commentModal.postId,
        user_id: currentUserId,
        comment: newComment.trim(),
      });

      if (error) throw error;

      // Refresh comments
      const { data: comments } = await supabase
        .from('post_comments')
        .select('*, profiles(full_name, avatar_url)')
        .eq('post_id', commentModal.postId)
        .order('created_at', { ascending: false })
        .limit(3);

      setPostComments((prev) => ({
        ...prev,
        [commentModal.postId!]: comments || [],
      }));

      setNewComment('');
      setCommentModal({ visible: false, postId: null });
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Yorum eklenemedi.');
    }
  }, [commentModal, currentUserId, newComment]);

  const onViewableItemsChanged = useRef(({ viewableItems: vItems }: { viewableItems: ViewToken[] }) => {
    setViewableItems(vItems);
    
    // Auto-play video for visible item
    vItems.forEach((item) => {
      if (item.item && item.item.media_type === 'video') {
        const videoRef = videoRefs.current[item.item.id];
        if (videoRef && item.isViewable) {
          videoRef.playAsync();
        }
      }
    });

    // Pause videos that are not visible
    feed.forEach((post) => {
      if (post.media_type === 'video') {
        const isVisible = vItems.some((vi) => vi.item?.id === post.id && vi.isViewable);
        const videoRef = videoRefs.current[post.id];
        if (videoRef && !isVisible) {
          videoRef.pauseAsync();
        }
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderPost = ({ item, index }: { item: any; index: number }) => {
    const isVisible = viewableItems.some((vi) => vi.item?.id === item.id && vi.isViewable);
    const hasServiceLink = item.service_link;

    return (
      <View style={styles.postContainer}>
        {/* MEDIA */}
        <View style={styles.mediaContainer}>
          {item.media_type === 'video' ? (
            <Video
              ref={(ref) => {
                if (ref) videoRefs.current[item.id] = ref;
              }}
              source={{ uri: item.media_url }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isVisible && index === currentIndex}
              isLooping
              isMuted={false}
            />
          ) : (
            <Image source={{ uri: item.media_url }} style={styles.media} resizeMode="cover" />
          )}

          {/* OVERLAY GRADIENT */}
          <View style={styles.overlayGradient} />

          {/* RIGHT SIDE ACTIONS */}
          <View style={styles.rightActions}>
            {/* PROFILE AVATAR */}
            <TouchableOpacity
              onPress={() => router.push(`/business/${item.business_id || item.user_id}`)}
              style={styles.avatarButton}>
              <Image
                source={{ uri: item.user?.avatar_url || 'https://via.placeholder.com/50' }}
                style={styles.avatar}
              />
            </TouchableOpacity>

            {/* LIKE BUTTON */}
            <TouchableOpacity onPress={() => handleToggleLike(item.id)} style={styles.actionButton}>
              <Ionicons
                name={item.is_liked ? 'heart' : 'heart-outline'}
                size={32}
                color={item.is_liked ? '#F44336' : '#fff'}
              />
              <Text style={styles.actionCount}>{item.likes_count || 0}</Text>
            </TouchableOpacity>

            {/* COMMENT BUTTON */}
            <TouchableOpacity
              onPress={() => setCommentModal({ visible: true, postId: item.id })}
              style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={28} color="#fff" />
              <Text style={styles.actionCount}>{item.comments_count || 0}</Text>
            </TouchableOpacity>

            {/* SHARE BUTTON */}
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="share-outline" size={28} color="#fff" />
            </TouchableOpacity>

            {/* BOOK THIS LOOK BUTTON */}
            {hasServiceLink && (
              <TouchableOpacity
                onPress={() => handleBookThisLook(item.id)}
                style={[styles.actionButton, styles.bookButton]}>
                <Ionicons name="calendar" size={28} color="#4CAF50" />
                <Text style={[styles.actionCount, { color: '#4CAF50', fontWeight: 'bold' }]}>
                  Rezervasyon
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* BOTTOM INFO */}
          <View style={styles.bottomInfo}>
            <View style={styles.userInfo}>
              <Text style={styles.username}>
                @{item.user?.business_name || item.user?.full_name || 'Kullanıcı' || 'İşletme'}
              </Text>
              {item.caption && <Text style={styles.caption}>{item.caption}</Text>}
              {item.service_name && (
                <View style={styles.serviceTag}>
                  <Ionicons name="cut-outline" size={14} color="#0095F6" />
                  <Text style={styles.serviceTagText}>{item.service_name}</Text>
                </View>
              )}
            </View>

            {/* RECENT COMMENTS PREVIEW */}
            {postComments[item.id] && postComments[item.id].length > 0 && (
              <View style={styles.commentsPreview}>
                {postComments[item.id].slice(0, 2).map((comment: any, idx: number) => (
                  <View key={idx} style={styles.commentItem}>
                    <Text style={styles.commentUsername}>
                      {comment.profiles?.full_name || 'Kullanıcı'}:{' '}
                    </Text>
                    <Text style={styles.commentText}>{comment.comment}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (feed.length === 0 && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.emptyText}>Feed yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={feed}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          feed.length > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : null
        }
      />

      {/* COMMENT MODAL */}
      <Modal visible={commentModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yorumlar</Text>
              <TouchableOpacity onPress={() => setCommentModal({ visible: false, postId: null })}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={postComments[commentModal.postId || ''] || []}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Image
                    source={{ uri: item.profiles?.avatar_url || 'https://via.placeholder.com/40' }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentContent}>
                    <Text style={styles.commentAuthor}>
                      {item.profiles?.full_name || 'Kullanıcı'}
                    </Text>
                    <Text style={styles.commentBody}>{item.comment}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.noComments}>Henüz yorum yok</Text>
              }
            />

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Yorum yaz..."
                placeholderTextColor="#666"
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity onPress={handleAddComment} style={styles.sendButton}>
                <Ionicons name="send" size={20} color="#0095F6" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#fff', marginTop: 16, fontSize: 16 },
  postContainer: { width, height, backgroundColor: '#000' },
  mediaContainer: { flex: 1, position: 'relative' },
  media: { width: '100%', height: '100%' },
  overlayGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
    gap: 24,
  },
  avatarButton: {
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 30,
    padding: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  bookButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  actionCount: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    padding: 16,
    paddingBottom: 40,
  },
  userInfo: { marginBottom: 12 },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  caption: { color: '#fff', fontSize: 14, lineHeight: 20 },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 149, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 4,
  },
  serviceTagText: { color: '#0095F6', fontSize: 12, fontWeight: '600' },
  commentsPreview: { marginTop: 8 },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  commentUsername: { color: '#fff', fontWeight: '600', fontSize: 13 },
  commentText: { color: '#fff', fontSize: 13 },
  footer: { padding: 20, alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  commentAvatar: { width: 40, height: 40, borderRadius: 20 },
  commentContent: { flex: 1 },
  commentAuthor: { color: '#fff', fontWeight: '600', marginBottom: 4 },
  commentBody: { color: '#ccc', fontSize: 14 },
  noComments: { color: '#666', textAlign: 'center', marginTop: 40 },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: { padding: 8 },
});
