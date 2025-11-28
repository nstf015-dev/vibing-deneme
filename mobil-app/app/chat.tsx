import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  markAsRead,
  subscribeToMessages,
  Message,
  Conversation,
} from '../services/chat/chat-service';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params.conversation_id as string | undefined;
  const userId = params.user_id as string | undefined;
  const businessId = params.business_id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initializeChat();
  }, [conversationId, userId, businessId]);

  useEffect(() => {
    if (conversation) {
      const unsubscribe = subscribeToMessages(conversation.id, (message) => {
        setMessages((prev) => [...prev, message]);
        markAsRead(conversation.id, currentUserId || '');
      });

      return () => {
        unsubscribe();
      };
    }
  }, [conversation, currentUserId]);

  const initializeChat = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Giriş Gerekli', 'Mesajlaşmak için giriş yapmalısınız.');
        router.back();
        return;
      }

      setCurrentUserId(user.id);

      // Get or create conversation
      const otherUserId = userId || businessId;
      if (!otherUserId) {
        Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı.');
        router.back();
        return;
      }

      const { conversation: conv, error } = await getOrCreateConversation(user.id, otherUserId);
      if (error || !conv) {
        Alert.alert('Hata', 'Sohbet başlatılamadı.');
        router.back();
        return;
      }

      setConversation(conv);

      // Load messages
      const { messages: msgs } = await getMessages(conv.id);
      setMessages(msgs);

      // Mark as read
      await markAsRead(conv.id, user.id);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Sohbet yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversation || !currentUserId) return;

    try {
      const result = await sendMessage({
        conversationId: conversation.id,
        senderId: currentUserId,
        content: newMessage.trim(),
        context: params.context_type
          ? {
              context_type: params.context_type as 'post' | 'appointment' | 'service',
              context_id: (params.context_id as string) || '',
            }
          : undefined,
      });

      if (result.success && result.messageId) {
        setNewMessage('');
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('Hata', result.error || 'Mesaj gönderilemedi.');
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Mesaj gönderilemedi.');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUserId;

    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        {!isMe && (
          <Image
            source={{ uri: 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        )}
        <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesajlaşma</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            placeholderTextColor="#666"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            disabled={!newMessage.trim()}>
            <Ionicons
              name="send"
              size={20}
              color={newMessage.trim() ? '#0095F6' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  chatContainer: { flex: 1 },
  messagesList: { padding: 15, paddingBottom: 10 },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  messageContainerMe: {
    flexDirection: 'row-reverse',
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: '#0095F6',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  messageTextMe: { color: '#000' },
  messageTime: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: { color: '#000', opacity: 0.7 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});

