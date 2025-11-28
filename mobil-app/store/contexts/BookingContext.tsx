/**
 * BOOKING CONTEXT
 * React Context API for booking-related state
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface SelectedService {
  serviceId: string;
  serviceName: string;
  duration: number;
  paddingTime: number;
  basePrice: number;
  staffId?: string;
  variablePricing?: Record<string, string>;
}

interface BookingState {
  selectedServices: SelectedService[];
  selectedDate: string | null;
  selectedTime: string | null;
  selectedStaffId: string | null;
  businessId: string | null;
  totalPrice: number;
}

interface BookingContextType extends BookingState {
  addService: (service: SelectedService) => void;
  removeService: (serviceId: string) => void;
  updateService: (serviceId: string, updates: Partial<SelectedService>) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setStaff: (staffId: string) => void;
  setBusiness: (businessId: string) => void;
  calculateTotalPrice: () => Promise<void>;
  clearBooking: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);

  const addService = useCallback((service: SelectedService) => {
    setSelectedServices((prev) => [...prev, service]);
  }, []);

  const removeService = useCallback((serviceId: string) => {
    setSelectedServices((prev) => prev.filter((s) => s.serviceId !== serviceId));
  }, []);

  const updateService = useCallback((serviceId: string, updates: Partial<SelectedService>) => {
    setSelectedServices((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, ...updates } : s))
    );
  }, []);

  const calculateTotalPrice = useCallback(async () => {
    let total = 0;
    selectedServices.forEach((service) => {
      total += service.basePrice;
      if (service.variablePricing) {
        const modifiers = Object.values(service.variablePricing).length * 10;
        total += modifiers;
      }
    });
    setTotalPrice(total);
  }, [selectedServices]);

  const clearBooking = useCallback(() => {
    setSelectedServices([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedStaffId(null);
    setBusinessId(null);
    setTotalPrice(0);
  }, []);

  // Calculate price when services change
  React.useEffect(() => {
    calculateTotalPrice();
  }, [selectedServices, calculateTotalPrice]);

  return (
    <BookingContext.Provider
      value={{
        selectedServices,
        selectedDate,
        selectedTime,
        selectedStaffId,
        businessId,
        totalPrice,
        addService,
        removeService,
        updateService,
        setDate: setSelectedDate,
        setTime: setSelectedTime,
        setStaff: setSelectedStaffId,
        setBusiness: setBusinessId,
        calculateTotalPrice,
        clearBooking,
      }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookingStore() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBookingStore must be used within BookingProvider');
  }
  return context;
}

