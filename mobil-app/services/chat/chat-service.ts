/**
 * CHAT SERVICE
 * 
 * Real-time messaging between clients and businesses
 * Supports context-aware conversations (linked to posts/bookings)
 */

import { supabase } from '../../lib/supabase';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'file';
  media_url: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count_1: number;
  unread_count_2: number;
  created_at: string;
}

export interface MessageContext {
  context_type: 'post' | 'appointment' | 'service';
  context_id: string;
}

/**
 * Get or create conversation between two users
 */
export async function getOrCreateConversation(
  userId1: string,
  userId2: string
): Promise<{ conversation: Conversation | null; error?: string }> {
  try {
    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1_id.eq.${userId1},participant_2_id.eq.${userId1}`)
      .or(`participant_1_id.eq.${userId2},participant_2_id.eq.${userId2}`)
      .single();

    if (existing) {
      return { conversation: existing };
    }

    // Create new conversation
    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert({
        participant_1_id: userId1,
        participant_2_id: userId2,
      })
      .select()
      .single();

    if (error) throw error;

    return { conversation: newConversation };
  } catch (error: any) {
    return { conversation: null, error: error.message };
  }
}

/**
 * Send a message
 */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  context?: MessageContext;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { conversationId, senderId, content, messageType = 'text', mediaUrl, context } = params;

    // Create message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: messageType,
        media_url: mediaUrl || null,
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Add context if provided
    if (context && message.id) {
      await supabase.from('message_context').insert({
        message_id: message.id,
        context_type: context.context_type,
        context_id: context.context_id,
      });
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        unread_count_1: senderId === (await getConversation(conversationId))?.participant_1_id ? 0 : 1,
        unread_count_2: senderId === (await getConversation(conversationId))?.participant_2_id ? 0 : 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return { success: true, messageId: message.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get conversation messages
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  cursor?: string
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('id', cursor);
    }

    const { data, error } = await query;

    if (error) throw error;

    const messages = (data || []).reverse(); // Reverse to show oldest first
    const nextCursor = messages.length === limit ? messages[0]?.id : null;

    return { messages, nextCursor };
  } catch (error) {
    console.error('Get messages error:', error);
    return { messages: [], nextCursor: null };
  }
}

/**
 * Mark messages as read
 */
export async function markAsRead(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Mark all unread messages as read
    await supabase
      .from('messages')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('read', false);

    // Update conversation unread count
    const conversation = await getConversation(conversationId);
    if (conversation) {
      const isParticipant1 = conversation.participant_1_id === userId;
      await supabase
        .from('conversations')
        .update({
          unread_count_1: isParticipant1 ? 0 : conversation.unread_count_1,
          unread_count_2: isParticipant1 ? conversation.unread_count_2 : 0,
        })
        .eq('id', conversationId);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user conversations
 */
export async function getUserConversations(
  userId: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Get conversations error:', error);
    return [];
  }
}

/**
 * Get conversation by ID
 */
async function getConversation(conversationId: string): Promise<Conversation | null> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  return data || null;
}

/**
 * Subscribe to real-time messages
 */
export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

