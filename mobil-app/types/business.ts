/**
 * BUSINESS DOMAIN TYPES
 */

export interface Business {
  id: string;
  business_name: string;
  business_type: string;
  avatar_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number;
  review_count: number;
  is_verified: boolean;
  opening_time: string | null;
  closing_time: string | null;
  working_hours: any; // JSON
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  price: string | null;
  duration: number | null;
  padding_time: number | null;
  category: string | null;
  is_active: boolean;
  display_order: number | null;
  required_resources: string[] | null;
  required_staff_roles: string[] | null;
}

export interface VariablePricing {
  id: string;
  service_id: string;
  variable_name: string;
  option_name: string;
  price_modifier: number;
}

export interface Staff {
  id: string;
  business_id: string;
  user_id: string | null;
  full_name: string;
  role: string | null;
  specialty: string | null;
  avatar_url: string | null;
  skills: string[] | null;
  commission_rate: number | null;
  is_active: boolean;
}

export interface StaffShift {
  id: string;
  staff_id: string;
  business_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_available: boolean;
}

export interface Appointment {
  id: string;
  client_id: string;
  business_id: string;
  staff_id: string | null;
  service_name: string;
  price: string;
  date: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface CancellationPolicy {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  hours_before: number;
  fee_percentage: number;
  is_default: boolean;
}

export interface Deposit {
  id: string;
  appointment_id: string | null;
  user_id: string;
  business_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded';
  payment_intent_id: string | null;
  refunded_at: string | null;
}

