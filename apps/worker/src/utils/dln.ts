import { DlnEventType } from '@incur-data/tx-parsing';

/**
 * Convert DlnEventType enum to string representation for storage
 */
export const getEventTypeString = (eventType: DlnEventType): string => {
  switch (eventType) {
    case DlnEventType.OrderCreated:
      return 'OrderCreated';
    case DlnEventType.OrderFulfilled:
      return 'OrderFulfilled';
    default:
      return '';
  }
};
