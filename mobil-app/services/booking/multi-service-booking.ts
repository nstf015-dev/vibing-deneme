/**
 * MULTI-SERVICE BOOKING ENGINE
 * 
 * Handles booking multiple services in a single appointment.
 * Finds continuous time slots that accommodate all selected services.
 */

import { supabase } from '../../lib/supabase';
import { calculateAvailability, AvailabilityParams, TimeSlot } from './availability-calculator';

export interface ServiceSelection {
  serviceId: string;
  serviceName: string;
  duration: number;
  paddingTime: number;
  staffId?: string; // Preferred staff
  variablePricing?: Record<string, string>; // Selected variable pricing options
}

export interface MultiServiceBookingParams {
  businessId: string;
  services: ServiceSelection[];
  date: string; // YYYY-MM-DD
  preferredStaffId?: string;
}

export interface BookingSlot {
  startTime: string;
  endTime: string;
  totalDuration: number;
  staffId: string;
  services: ServiceSelection[];
  canAccommodate: boolean;
}

/**
 * Find available slots for multi-service booking
 */
export async function findMultiServiceSlots(
  params: MultiServiceBookingParams
): Promise<BookingSlot[]> {
  const { businessId, services, date, preferredStaffId } = params;

  // Calculate total duration
  const totalDuration = services.reduce(
    (sum, service) => sum + service.duration + service.paddingTime,
    0
  );

  // Get all staff who can perform ALL selected services
  const eligibleStaff = await getEligibleStaff(businessId, services, preferredStaffId);

  if (eligibleStaff.length === 0) {
    return []; // No staff can perform all services
  }

  // For each eligible staff, find available slots
  const allSlots: BookingSlot[] = [];

  for (const staff of eligibleStaff) {
    const availabilityParams: AvailabilityParams = {
      businessId,
      staffId: staff.id,
      date,
      duration: totalDuration,
    };

    const availableSlots = await calculateAvailability(availabilityParams);

    // Convert to booking slots
    const bookingSlots = availableSlots
      .filter((slot) => slot.available)
      .map((slot) => ({
        startTime: slot.time,
        endTime: addMinutes(slot.time, totalDuration),
        totalDuration,
        staffId: staff.id,
        services,
        canAccommodate: true,
      }));

    allSlots.push(...bookingSlots);
  }

  // Sort by time
  return allSlots.sort((a, b) => {
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

/**
 * Get staff members who can perform all selected services
 */
async function getEligibleStaff(
  businessId: string,
  services: ServiceSelection[],
  preferredStaffId?: string
): Promise<any[]> {
  // Get all staff for this business
  const { data: allStaff } = await supabase
    .from('staff')
    .select('*')
    .eq('business_id', businessId);

  if (!allStaff) return [];

  // Get service IDs
  const serviceIds = services.map((s) => s.serviceId);

  // Get staff-service assignments
  const { data: staffServices } = await supabase
    .from('staff_services')
    .select('staff_id, service_id')
    .in('service_id', serviceIds);

  if (!staffServices) {
    // Fallback: if no assignments, return all staff (backward compatibility)
    return preferredStaffId
      ? allStaff.filter((s) => s.id === preferredStaffId)
      : allStaff;
  }

  // Find staff who have ALL required services assigned
  const staffServiceMap = new Map<string, Set<string>>();
  staffServices.forEach((ss) => {
    if (!staffServiceMap.has(ss.staff_id)) {
      staffServiceMap.set(ss.staff_id, new Set());
    }
    staffServiceMap.get(ss.staff_id)!.add(ss.service_id);
  });

  const eligibleStaff = allStaff.filter((staff) => {
    const assignedServices = staffServiceMap.get(staff.id);
    if (!assignedServices) return false;

    // Check if staff has ALL required services
    const hasAllServices = serviceIds.every((serviceId) =>
      assignedServices.has(serviceId)
    );

    return hasAllServices;
  });

  // If preferred staff is specified and eligible, prioritize them
  if (preferredStaffId) {
    const preferred = eligibleStaff.find((s) => s.id === preferredStaffId);
    if (preferred) {
      return [preferred, ...eligibleStaff.filter((s) => s.id !== preferredStaffId)];
    }
  }

  return eligibleStaff;
}

/**
 * Create multi-service appointment
 */
export async function createMultiServiceAppointment(params: {
  businessId: string;
  clientId: string;
  staffId: string;
  date: string;
  startTime: string;
  services: ServiceSelection[];
  totalPrice: number;
  notes?: string;
}): Promise<{ appointmentId: string; error?: string }> {
  const { businessId, clientId, staffId, date, startTime, services, totalPrice, notes } = params;

  try {
    // Format date string
    const formattedDate = `${date}, ${startTime}`;

    // Create main appointment record
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        client_id: clientId,
        business_id: businessId,
        staff_id: staffId,
        service_name: services.map((s) => s.serviceName).join(' + '), // Combined name
        price: `${totalPrice}₺`,
        date: formattedDate,
        status: 'pending',
        notes: notes || null,
      })
      .select()
      .single();

    if (appointmentError || !appointment) {
      return { appointmentId: '', error: appointmentError?.message };
    }

    // Create appointment-services junction records
    const appointmentServices = services.map((service) => ({
      appointment_id: appointment.id,
      service_id: service.serviceId,
      service_name: service.serviceName,
      duration: service.duration,
      padding_time: service.paddingTime,
      variable_pricing: service.variablePricing || null,
    }));

    const { error: junctionError } = await supabase
      .from('appointment_services')
      .insert(appointmentServices);

    if (junctionError) {
      // Rollback: delete appointment if junction insert fails
      await supabase.from('appointments').delete().eq('id', appointment.id);
      return { appointmentId: '', error: junctionError.message };
    }

    return { appointmentId: appointment.id };
  } catch (error: any) {
    return { appointmentId: '', error: error.message };
  }
}

/**
 * Calculate total price including variable pricing
 */
export async function calculateMultiServicePrice(
  services: ServiceSelection[]
): Promise<number> {
  let totalPrice = 0;

  for (const service of services) {
    // Get base price
    const { data: serviceData } = await supabase
      .from('business_services')
      .select('base_price, price')
      .eq('id', service.serviceId)
      .single();

    if (!serviceData) continue;

    let servicePrice = serviceData.base_price || 0;
    if (!servicePrice && serviceData.price) {
      // Parse price string (e.g., "300₺" -> 300)
      servicePrice = parseFloat(serviceData.price.replace(/[^0-9.]/g, '')) || 0;
    }

    // Add variable pricing modifiers
    if (service.variablePricing) {
      const { data: variablePricing } = await supabase
        .from('service_variable_pricing')
        .select('price_modifier')
        .eq('service_id', service.serviceId)
        .in('option_name', Object.values(service.variablePricing));

      if (variablePricing) {
        const modifiers = variablePricing.reduce(
          (sum, vp) => sum + (vp.price_modifier || 0),
          0
        );
        servicePrice += modifiers;
      }
    }

    totalPrice += servicePrice;
  }

  return totalPrice;
}

/**
 * Helper: Add minutes to time string
 */
function addMinutes(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Helper: Convert time to minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

