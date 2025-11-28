/**
 * PAYMENT PROCESSOR
 * 
 * Handles payment processing, deposits, and refunds
 */

import { supabase } from '../../lib/supabase';

export interface PaymentIntent {
  id: string;
  appointment_id: string | null;
  user_id: string;
  business_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  metadata: any;
}

/**
 * Create payment intent
 */
export async function createPaymentIntent(params: {
  userId: string;
  businessId: string;
  amount: number;
  appointmentId?: string;
  paymentMethod?: string;
  metadata?: any;
}): Promise<{ success: boolean; intentId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payment_intents')
      .insert({
        user_id: params.userId,
        business_id: params.businessId,
        amount: params.amount,
        currency: 'TRY',
        appointment_id: params.appointmentId || null,
        payment_method: params.paymentMethod || null,
        status: 'pending',
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Create Stripe payment intent
    // const stripeIntent = await stripe.paymentIntents.create({...});

    return { success: true, intentId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Process deposit for high-value services
 */
export async function processDeposit(params: {
  userId: string;
  businessId: string;
  appointmentId: string;
  amount: number;
}): Promise<{ success: boolean; depositId?: string; error?: string }> {
  try {
    // Create payment intent for deposit
    const paymentResult = await createPaymentIntent({
      userId: params.userId,
      businessId: params.businessId,
      amount: params.amount,
      appointmentId: params.appointmentId,
      paymentMethod: 'card',
      metadata: { type: 'deposit' },
    });

    if (!paymentResult.success) {
      return paymentResult;
    }

    // Create deposit record
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        user_id: params.userId,
        business_id: params.businessId,
        appointment_id: params.appointmentId,
        amount: params.amount,
        currency: 'TRY',
        status: 'pending',
        payment_intent_id: paymentResult.intentId || null,
      })
      .select()
      .single();

    if (depositError) throw depositError;

    return { success: true, depositId: deposit.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Process refund for cancellation
 */
export async function processRefund(params: {
  appointmentId: string;
  cancellationPolicyId?: string;
}): Promise<{ success: boolean; refundAmount?: number; error?: string }> {
  try {
    // Get appointment
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, deposit:deposits(*)')
      .eq('id', params.appointmentId)
      .single();

    if (!appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    // Calculate refund amount based on cancellation policy
    let refundAmount = 0;
    const appointmentPrice = parseFloat((appointment.price || '0').replace(/[^0-9.]/g, ''));

    if (params.cancellationPolicyId) {
      const { data: policy } = await supabase
        .from('cancellation_policies')
        .select('fee_percentage')
        .eq('id', params.cancellationPolicyId)
        .single();

      if (policy) {
        const feePercentage = policy.fee_percentage || 0;
        refundAmount = appointmentPrice * (1 - feePercentage / 100);
      }
    } else {
      // Full refund if no policy
      refundAmount = appointmentPrice;
    }

    // If deposit exists, refund deposit
    if (appointment.deposit && appointment.deposit.length > 0) {
      const deposit = appointment.deposit[0];
      
      // Update deposit status
      await supabase
        .from('deposits')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
        })
        .eq('id', deposit.id);

      refundAmount = deposit.amount; // Refund deposit amount
    }

    // TODO: Process Stripe refund
    // await stripe.refunds.create({...});

    // Update payment intent status
    if (appointment.deposit && appointment.deposit[0]?.payment_intent_id) {
      await supabase
        .from('payment_intents')
        .update({ status: 'refunded' })
        .eq('id', appointment.deposit[0].payment_intent_id);
    }

    return { success: true, refundAmount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get cancellation fee based on policy
 */
export async function getCancellationFee(params: {
  businessId: string;
  appointmentDate: string;
  appointmentPrice: number;
}): Promise<{ feeAmount: number; feePercentage: number }> {
  try {
    const appointmentDateTime = new Date(params.appointmentDate);
    const now = new Date();
    const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Get applicable cancellation policy
    const { data: policies } = await supabase
      .from('cancellation_policies')
      .select('*')
      .eq('business_id', params.businessId)
      .lte('hours_before', hoursUntil)
      .order('hours_before', { ascending: false })
      .limit(1);

    if (policies && policies.length > 0) {
      const policy = policies[0];
      const feePercentage = policy.fee_percentage || 0;
      const feeAmount = params.appointmentPrice * (feePercentage / 100);

      return { feeAmount, feePercentage };
    }

    // No policy = no fee
    return { feeAmount: 0, feePercentage: 0 };
  } catch (error) {
    console.error('Get cancellation fee error:', error);
    return { feeAmount: 0, feePercentage: 0 };
  }
}

