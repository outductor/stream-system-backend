import axios from 'axios';
import { type StreamStatus, type Reservation, type CreateReservationRequest, type TimeSlot, buildReservation, buildStreamStatus, buildTimeSlot, type StreamStatusResponse, type ReservationResponse, type TimeSlotResponse, type EventConfig, type EventConfigResponse, buildEventConfig } from '../types/api';
import type { Temporal } from 'temporal-polyfill';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const streamApi = {
  getStatus: async (): Promise<StreamStatus> => {
    const response = await apiClient.get<StreamStatusResponse>('/stream/status');
    return buildStreamStatus(response.data);
  },
};

export const reservationsApi = {
  getReservations: async (date?: string): Promise<Reservation[]> => {
    const params = date ? { date } : undefined;
    const response = await apiClient.get<ReservationResponse[]>('/reservations', { params });
    return response.data.map(buildReservation);
  },

  createReservation: async (data: CreateReservationRequest): Promise<Reservation> => {
    const response = await apiClient.post<ReservationResponse>('/reservations', {
      djName: data.djName,
      startTime: data.startTime.toString(),
      endTime: data.endTime.toString(),
      passcode: data.passcode,
    });
    return buildReservation(response.data);
  },

  deleteReservation: async (id: string, passcode: string): Promise<void> => {
    await apiClient.delete(`/reservations/${id}`, {
      data: { passcode },
    });
  },

  getAvailableSlots: async (startTime: Temporal.Instant, endTime?: Temporal.Instant): Promise<TimeSlot[]> => {
    const params: { startTime: string; endTime?: string } = { startTime: startTime.toString() };
    if (endTime) {
      params.endTime = endTime.toString();
    }
    const response = await apiClient.get<TimeSlotResponse[]>('/available-slots', {
      params,
    });
    return response.data.map(buildTimeSlot);
  },
};

export const configApi = {
  getEventConfig: async (): Promise<EventConfig> => {
    const response = await apiClient.get<EventConfigResponse>('/event-config');
    return buildEventConfig(response.data);
  },
};