/**
 * AVAILABILITY CALCULATOR
 * 
 * Core algorithm for calculating available booking slots.
 * Considers: Staff shifts, breaks, service duration, padding time, existing bookings.
 */

import { supabase } from '../../lib/supabase';

export interface TimeSlot {
  time: string; // HH:mm format
  available: boolean;
  reason?: 'booked' | 'break' | 'shift_unavailable' | 'resource_unavailable';
  metadata?: {
    staffId?: string;
    serviceId?: string;
    resourceId?: string;
  };
}

export interface AvailabilityParams {
  businessId: string;
  staffId?: string; // Optional: specific staff member
  serviceId?: string; // Optional: specific service
  date: string; // YYYY-MM-DD format
  duration: number; // Total duration in minutes (service + padding)
  resourceId?: string; // Optional: specific resource (chair, room)
}

export interface ServiceDetails {
  duration: number;
  padding_time: number;
  required_resources?: string[];
}

/**
 * Calculate available time slots for a given date
 */
export async function calculateAvailability(
  params: AvailabilityParams
): Promise<TimeSlot[]> {
  const { businessId, staffId, serviceId, date, duration, resourceId } = params;

  // 1. Get all staff members (or specific staff)
  const staffQuery = supabase
    .from('staff')
    .select('*')
    .eq('business_id', businessId);

  if (staffId) {
    staffQuery.eq('id', staffId);
  }

  const { data: staffMembers, error: staffError } = await staffQuery;

  if (staffError || !staffMembers || staffMembers.length === 0) {
    return [];
  }

  // 2. Get service details if serviceId provided
  let serviceDetails: ServiceDetails | null = null;
  if (serviceId) {
    const { data: service } = await supabase
      .from('business_services')
      .select('duration, padding_time, required_resources')
      .eq('id', serviceId)
      .single();

    if (service) {
      serviceDetails = {
        duration: service.duration || 30,
        padding_time: service.padding_time || 0,
        required_resources: service.required_resources || [],
      };
    }
  }

  // 3. Generate base time slots (9:00 - 21:00, 30-min intervals)
  const baseSlots = generateTimeSlots('09:00', '21:00', 30);

  // 4. For each staff member, calculate availability
  const allAvailableSlots: TimeSlot[] = [];

  for (const staff of staffMembers) {
    // Get staff shifts for this date
    const { data: shifts } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', staff.id)
      .eq('shift_date', date)
      .eq('is_available', true);

    if (!shifts || shifts.length === 0) {
      continue; // Staff not working this day
    }

    // Get staff breaks
    const { data: breaks } = await supabase
      .from('staff_breaks')
      .select('*')
      .eq('staff_id', staff.id)
      .eq('date', date);

    // Get existing appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('staff_id', staff.id)
      .eq('status', 'confirmed')
      .ilike('date', `%${date}%`);

    // Get service durations for existing appointments
    const appointmentDurations = await getAppointmentDurations(
      appointments || [],
      businessId
    );

    // Calculate available slots for this staff
    const staffSlots = calculateStaffAvailability({
      baseSlots,
      shifts: shifts || [],
      breaks: breaks || [],
      appointments: appointments || [],
      appointmentDurations,
      duration: serviceDetails
        ? serviceDetails.duration + serviceDetails.padding_time
        : duration,
      staffId: staff.id,
    });

    allAvailableSlots.push(...staffSlots);
  }

  // 5. If resourceId specified, filter by resource availability
  if (resourceId) {
    return filterByResourceAvailability(allAvailableSlots, resourceId, date);
  }

  // 6. Remove duplicates and sort
  return deduplicateAndSort(allAvailableSlots);
}

/**
 * Calculate availability for a specific staff member
 */
function calculateStaffAvailability(params: {
  baseSlots: string[];
  shifts: any[];
  breaks: any[];
  appointments: any[];
  appointmentDurations: Map<string, number>;
  duration: number;
  staffId: string;
}): TimeSlot[] {
  const { baseSlots, shifts, breaks, appointments, appointmentDurations, duration, staffId } = params;

  return baseSlots.map((slotTime) => {
    const slotMinutes = timeToMinutes(slotTime);

    // Check if within any shift
    const activeShift = shifts.find((shift) => {
      const shiftStart = timeToMinutes(shift.start_time);
      const shiftEnd = timeToMinutes(shift.end_time);
      return slotMinutes >= shiftStart && slotMinutes + duration <= shiftEnd;
    });

    if (!activeShift) {
      return {
        time: slotTime,
        available: false,
        reason: 'shift_unavailable',
        metadata: { staffId },
      };
    }

    // Check break conflicts
    const hasBreakConflict = breaks.some((brk) => {
      const breakStart = timeToMinutes(brk.start_time);
      const breakEnd = breakStart + (brk.duration || 30);
      return slotMinutes < breakEnd && slotMinutes + duration > breakStart;
    });

    if (hasBreakConflict) {
      return {
        time: slotTime,
        available: false,
        reason: 'break',
        metadata: { staffId },
      };
    }

    // Check appointment conflicts
    const hasAppointmentConflict = appointments.some((app) => {
      const appTimeMatch = app.date?.match(/(\d{2}):(\d{2})/);
      if (!appTimeMatch) return false;

      const appMinutes = timeToMinutes(`${appTimeMatch[1]}:${appTimeMatch[2]}`);
      const appDuration = appointmentDurations.get(app.id) || 30;

      // Conflict if new slot overlaps with existing appointment
      return slotMinutes < appMinutes + appDuration && slotMinutes + duration > appMinutes;
    });

    if (hasAppointmentConflict) {
      return {
        time: slotTime,
        available: false,
        reason: 'booked',
        metadata: { staffId },
      };
    }

    return {
      time: slotTime,
      available: true,
      metadata: { staffId },
    };
  });
}

/**
 * Get appointment durations (service + padding time)
 */
async function getAppointmentDurations(
  appointments: any[],
  businessId: string
): Promise<Map<string, number>> {
  const durations = new Map<string, number>();

  if (appointments.length === 0) return durations;

  // Get unique service names
  const serviceNames = [...new Set(appointments.map((app) => app.service_name))];

  // Fetch service details
  const { data: services } = await supabase
    .from('business_services')
    .select('name, duration, padding_time')
    .eq('business_id', businessId)
    .in('name', serviceNames);

  if (!services) return durations;

  // Create service duration map
  const serviceDurationMap = new Map<string, number>();
  services.forEach((service) => {
    serviceDurationMap.set(
      service.name,
      (service.duration || 30) + (service.padding_time || 0)
    );
  });

  // Map appointment IDs to durations
  appointments.forEach((app) => {
    const duration = serviceDurationMap.get(app.service_name) || 30;
    durations.set(app.id, duration);
  });

  return durations;
}

/**
 * Filter slots by resource availability
 */
async function filterByResourceAvailability(
  slots: TimeSlot[],
  resourceId: string,
  date: string
): Promise<TimeSlot[]> {
  // Get resource availability
  const { data: resourceAvailability } = await supabase
    .from('resource_availability')
    .select('*')
    .eq('resource_id', resourceId)
    .eq('date', date);

  if (!resourceAvailability || resourceAvailability.length === 0) {
    return slots; // Resource available all day
  }

  return slots.map((slot) => {
    const isResourceAvailable = resourceAvailability.some((ra) => {
      const raStart = timeToMinutes(ra.start_time);
      const raEnd = timeToMinutes(ra.end_time);
      const slotMinutes = timeToMinutes(slot.time);
      return slotMinutes >= raStart && slotMinutes < raEnd && ra.is_available;
    });

    if (!isResourceAvailable && slot.available) {
      return {
        ...slot,
        available: false,
        reason: 'resource_unavailable',
      };
    }

    return slot;
  });
}

/**
 * Generate time slots between start and end time
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  while (current < end) {
    const hours = Math.floor(current / 60);
    const minutes = current % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    current += intervalMinutes;
  }

  return slots;
}

/**
 * Convert time string (HH:mm) to minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Remove duplicate slots and sort
 */
function deduplicateAndSort(slots: TimeSlot[]): TimeSlot[] {
  const unique = new Map<string, TimeSlot>();

  slots.forEach((slot) => {
    const key = slot.time;
    if (!unique.has(key) || slot.available) {
      unique.set(key, slot);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  });
}

