import { createContext, useContext } from 'react';
import { Temporal } from 'temporal-polyfill';

// Context for the event timezone (default to browser timezone)
export const EventTimezoneContext = createContext<string>(Temporal.Now.timeZoneId());

// Hook to get the event timezone
export const useEventTimezone = (): string => {
  return useContext(EventTimezoneContext);
};
