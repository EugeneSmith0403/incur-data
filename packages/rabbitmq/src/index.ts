/**
 * RabbitMQ package exports
 */

// Types
export type {
  QueueConfig,
  PublishOptions,
  MessageHandler,
  MessageMetadata,
  ConsumerConfig,
  RabbitMQConfig,
} from './types.js';

// Publisher
export {
  RabbitMQPublisher,
  createPublisher,
} from './publisher.js';

// Consumer
export {
  RabbitMQConsumer,
  createConsumer,
} from './consumer.js';

// Queue Setup
export {
  setupQueues,
  createQueueConfig,
  purgeQueue,
  deleteQueue,
  getQueueStats,
} from './queue-setup.js';
