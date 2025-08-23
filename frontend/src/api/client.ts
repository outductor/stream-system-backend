import axios from 'axios';
import type { StreamStatus, Reservation, CreateReservationRequest, TimeSlot } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const streamApi = {
  getStatus: async (): Promise<StreamStatus> => {
    const response = await apiClient.get<StreamStatus>('/stream/status');
    return response.data;
  },
};

export const reservationsApi = {
  getReservations: async (date?: string): Promise<Reservation[]> => {
    const params = date ? { date } : undefined;
    const response = await apiClient.get<Reservation[]>('/reservations', { params });
    return response.data;
  },

  createReservation: async (data: CreateReservationRequest): Promise<Reservation> => {
    const response = await apiClient.post<Reservation>('/reservations', data);
    return response.data;
  },

  deleteReservation: async (id: string, passcode: string): Promise<void> => {
    await apiClient.delete(`/reservations/${id}`, {
      data: { passcode },
    });
  },

  getAvailableSlots: async (startTime: string, endTime?: string): Promise<TimeSlot[]> => {
    const params: { startTime: string; endTime?: string } = { startTime };
    if (endTime) {
      params.endTime = endTime;
    }
    const response = await apiClient.get<TimeSlot[]>('/available-slots', {
      params,
    });
    return response.data;
  },
};