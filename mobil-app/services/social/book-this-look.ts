/**
 * BOOK THIS LOOK SERVICE
 * 
 * Handles the "Book This Look" feature - direct booking from social posts
 */

import { supabase } from '../../lib/supabase';

export interface BookThisLookParams {
  postId: string;
  userId: string;
}

export interface BookThisLookResult {
  success: boolean;
  serviceId: string | null;
  serviceName: string | null;
  staffId: string | null;
  businessId: string | null;
  error?: string;
}

/**
 * Get booking information from a post
 */
export async function getBookThisLookInfo(
  postId: string
): Promise<BookThisLookResult> {
  try {
    // Get post-service link
    const { data: serviceLink, error: linkError } = await supabase
      .from('post_service_link')
      .select('*, service:business_services(*), business:profiles!business_id(id, business_name)')
      .eq('post_id', postId)
      .single();

    if (linkError || !serviceLink) {
      return {
        success: false,
        serviceId: null,
        serviceName: null,
        staffId: null,
        businessId: null,
        error: 'Bu gönderi için hizmet bağlantısı bulunamadı.',
      };
    }

    return {
      success: true,
      serviceId: serviceLink.service_id,
      serviceName: serviceLink.service?.name || null,
      staffId: serviceLink.staff_id || null,
      businessId: serviceLink.business_id,
    };
  } catch (error: any) {
    return {
      success: false,
      serviceId: null,
      serviceName: null,
      staffId: null,
      businessId: null,
      error: error.message,
    };
  }
}

/**
 * Initialize booking from post
 */
export async function initializeBookingFromPost(
  postId: string,
  router: any
): Promise<boolean> {
  const bookingInfo = await getBookThisLookInfo(postId);

  if (!bookingInfo.success || !bookingInfo.serviceId || !bookingInfo.businessId) {
    return false;
  }

  // Get service details
  const { data: service } = await supabase
    .from('business_services')
    .select('*')
    .eq('id', bookingInfo.serviceId)
    .single();

  if (!service) {
    return false;
  }

  // Navigate to booking screen with all parameters
  router.push({
    pathname: '/booking' as any,
    params: {
      business_id: bookingInfo.businessId,
      service_name: bookingInfo.serviceName || service.name,
      staff_id: bookingInfo.staffId || '',
      from_post: postId,
      service_id: bookingInfo.serviceId,
    },
  });

  return true;
}

/**
 * Link a post to a service (for businesses)
 */
export async function linkPostToService(params: {
  postId: string;
  serviceId: string;
  staffId?: string;
  businessId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { postId, serviceId, staffId, businessId } = params;

    // Check if link already exists
    const { data: existing } = await supabase
      .from('post_service_link')
      .select('id')
      .eq('post_id', postId)
      .eq('service_id', serviceId)
      .single();

    if (existing) {
      // Update existing link
      const { error } = await supabase
        .from('post_service_link')
        .update({
          staff_id: staffId || null,
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new link
      const { error } = await supabase.from('post_service_link').insert({
        post_id: postId,
        service_id: serviceId,
        staff_id: staffId || null,
        business_id: businessId,
      });

      if (error) throw error;
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

