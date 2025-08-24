import { Temporal } from "temporal-polyfill";

export interface StreamStatus {
  isLive: boolean;
  currentDj?: string;
  nextDj?: string;
  currentStartTime?: Temporal.Instant;
  currentEndTime?: Temporal.Instant;
  nextStartTime?: Temporal.Instant;
}

export interface StreamStatusResponse {
  isLive: boolean;
  currentDj?: string;
  nextDj?: string;
  currentStartTime?: string;
  currentEndTime?: string;
  nextStartTime?: string;
}

export const buildStreamStatus = (plainData: StreamStatusResponse): StreamStatus => {
  return {
    isLive: plainData.isLive,
    currentDj: plainData.currentDj,
    nextDj: plainData.nextDj,
    currentStartTime: plainData.currentStartTime ? Temporal.Instant.from(plainData.currentStartTime) : undefined,
    currentEndTime: plainData.currentEndTime ? Temporal.Instant.from(plainData.currentEndTime) : undefined,
    nextStartTime: plainData.nextStartTime ? Temporal.Instant.from(plainData.nextStartTime) : undefined
  };
};

export interface Reservation {
  id: string;
  djName: string;
  startTime: Temporal.Instant;
  endTime: Temporal.Instant;
  createdAt: Temporal.Instant;
}

export interface ReservationResponse {
  id: string;
  djName: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export const buildReservation = (plainData: ReservationResponse): Reservation => {
  return {
    id: plainData.id,
    djName: plainData.djName,
    startTime: Temporal.Instant.from(plainData.startTime),
    endTime: Temporal.Instant.from(plainData.endTime),
    createdAt: Temporal.Instant.from(plainData.createdAt),
  };
};

export interface CreateReservationRequest {
  djName: string;
  startTime: Temporal.Instant;
  endTime: Temporal.Instant;
  passcode: string;
}

export interface TimeSlot {
  startTime: Temporal.Instant;
  endTime: Temporal.Instant;
  available: boolean;
}

export interface TimeSlotResponse {
  startTime: string;
  endTime: string;
  available: boolean;
}

export const buildTimeSlot = (plainData: TimeSlotResponse): TimeSlot => {
  return {
    startTime: Temporal.Instant.from(plainData.startTime),
    endTime: Temporal.Instant.from(plainData.endTime),
    available: plainData.available,
  };
};

export interface ApiError {
  code: 'TIME_CONFLICT' | 'PAST_TIME' | 'INVALID_TIME_INTERVAL' | 'DURATION_TOO_LONG' | 'INVALID_PASSCODE' | 'BEFORE_EVENT_START' | 'EXCEEDS_EVENT_END';
  message: string;
}

export interface EventConfig {
  eventStartTime?: Temporal.Instant;
  eventEndTime?: Temporal.Instant;
}

export interface EventConfigResponse {
  eventStartTime?: string;
  eventEndTime?: string;
}

export const buildEventConfig = (plainData: EventConfigResponse): EventConfig => {
  return {
    eventStartTime: plainData.eventStartTime ? Temporal.Instant.from(plainData.eventStartTime) : undefined,
    eventEndTime: plainData.eventEndTime ? Temporal.Instant.from(plainData.eventEndTime) : undefined,
  };
};