/**
 * WAITLIST MANAGER
 * 
 * Manages waitlist entries and notifications when slots become available
 */

import { supabase } from '../../lib/supabase';

export interface WaitlistEntry {
  id: string;
  user_id: string;
  business_id: string;
  service_name: string;
  desired_date: string;
  notes: string | null;
  notified: boolean;
  created_at: string;
}

/**
 * Add user to waitlist
 */
export async function addToWaitlist(params: {
  userId: string;
  businessId: string;
  serviceName: string;
  desiredDate: string;
  notes?: string;
}): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('waitlist_entries')
      .insert({
        user_id: params.userId,
        business_id: params.businessId,
        service_name: params.serviceName,
        desired_date: params.desiredDate,
        notes: params.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, entryId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Check waitlist when appointment is cancelled
 */
export async function checkWaitlistOnCancellation(
  appointmentId: string
): Promise<void> {
  try {
    // Get cancelled appointment details
    const { data: appointment } = await supabase
      .from('appointments')
      .select('business_id, service_name, date, staff_id')
      .eq('id', appointmentId)
      .single();

    if (!appointment) return;

    // Extract date from appointment
    const appointmentDate = extractDate(appointment.date);

    // Find matching waitlist entries
    const { data: waitlistEntries } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('business_id', appointment.business_id)
      .eq('service_name', appointment.service_name)
      .eq('desired_date', appointmentDate)
      .eq('notified', false)
      .order('created_at', { ascending: true })
      .limit(10); // Notify top 10

    if (!waitlistEntries || waitlistEntries.length === 0) return;

    // Notify first entry (FIFO)
    const firstEntry = waitlistEntries[0];

    // Create notification
    await supabase.from('notifications').insert({
      user_id: firstEntry.user_id,
      type: 'waitlist_available',
      title: 'Randevu Müsait!',
      message: `${appointment.service_name} için istediğiniz tarihte randevu müsait. Hemen rezervasyon yapabilirsiniz!`,
      data: {
        business_id: appointment.business_id,
        service_name: appointment.service_name,
        date: appointmentDate,
        staff_id: appointment.staff_id,
      },
    });

    // Mark as notified
    await supabase
      .from('waitlist_entries')
      .update({ notified: true })
      .eq('id', firstEntry.id);

    // TODO: Send push notification
  } catch (error) {
    console.error('Waitlist check error:', error);
  }
}

/**
 * Get user's waitlist entries
 */
export async function getUserWaitlist(
  userId: string
): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('notified', false)
    .order('desired_date', { ascending: true });

  if (error) {
    console.error('Get waitlist error:', error);
    return [];
  }

  return data || [];
}

/**
 * Remove from waitlist
 */
export async function removeFromWaitlist(
  entryId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('waitlist_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId); // Ensure user owns the entry

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Extract date from appointment date string
 */
function extractDate(dateString: string): string {
  // Try to extract YYYY-MM-DD from various formats
  const dateMatch = dateString.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  // Fallback: try to parse
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // Last resort: return today
  return new Date().toISOString().split('T')[0];
}

