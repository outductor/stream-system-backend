export interface StreamStatus {
  isLive: boolean;
  currentDj?: string;
  nextDj?: string;
  currentStartTime?: string;
  currentEndTime?: string;
  nextStartTime?: string;
}

export interface Reservation {
  id: string;
  djName: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface CreateReservationRequest {
  djName: string;
  startTime: string;
  endTime: string;
  passcode: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface ApiError {
  code: 'TIME_CONFLICT' | 'PAST_TIME' | 'INVALID_TIME_INTERVAL' | 'DURATION_TOO_LONG' | 'INVALID_PASSCODE';
  message: string;
}