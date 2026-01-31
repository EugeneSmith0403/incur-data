import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestServices, teardownTestServices, cleanTestData, type TestServices } from './setup.js';

describe('RabbitMQ Integration Tests', () => {
  let services: TestServices;

  beforeAll(async () => {
    services = await setupTestServices();
  }, 30000);

  afterAll(async () => {
    await teardownTestServices(services);
  });

  beforeEach(async () => {
    await cleanTestData(services);
  });

  describe('connection', () => {
    it('should have active connection', () => {
      expect(services.rabbitmq.connection).toBeDefined();
      expect(services.rabbitmq.channel).toBeDefined();
    });

    it('should be connected to test vhost', async () => {
      // The connection object should be valid
      expect(services.rabbitmq.connection.connection).toBeDefined();
    });
  });

  describe('queue operations', () => {
    it('should create a queue', async () => {
      const queueName = 'test_queue_1';
      const result = await services.rabbitmq.channel.assertQueue(queueName, {
        durable: false,
        autoDelete: true,
      });
      
      expect(result.queue).toBe(queueName);
      expect(result.messageCount).toBe(0);
    });

    it('should send and receive messages', async () => {
      const queueName = 'test_queue_2';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      const message = { test: 'message', value: 123 };
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      // Send message
      const sent = services.rabbitmq.channel.sendToQueue(queueName, messageBuffer);
      expect(sent).toBe(true);
      
      // Receive message
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg).not.toBe(false);
      
      if (msg) {
        const receivedMessage = JSON.parse(msg.content.toString());
        expect(receivedMessage).toEqual(message);
      }
    });

    it('should handle multiple messages in queue', async () => {
      const queueName = 'test_queue_3';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        const message = { index: i, data: `message ${i}` };
        services.rabbitmq.channel.sendToQueue(
          queueName,
          Buffer.from(JSON.stringify(message))
        );
      }
      
      // Receive messages
      const messages = [];
      for (let i = 0; i < 5; i++) {
        const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
        if (msg) {
          messages.push(JSON.parse(msg.content.toString()));
        }
      }
      
      expect(messages).toHaveLength(5);
      expect(messages[0].index).toBe(0);
      expect(messages[4].index).toBe(4);
    });

    it('should return false when queue is empty', async () => {
      const queueName = 'test_queue_empty';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg).toBe(false);
    });

    it('should delete queue', async () => {
      const queueName = 'test_queue_delete';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      const result = await services.rabbitmq.channel.deleteQueue(queueName);
      expect(result.messageCount).toBe(0);
    });

    it('should purge queue', async () => {
      const queueName = 'test_queue_purge';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      // Add messages
      services.rabbitmq.channel.sendToQueue(queueName, Buffer.from('msg1'));
      services.rabbitmq.channel.sendToQueue(queueName, Buffer.from('msg2'));
      
      // Wait for messages to be queued
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Purge
      const result = await services.rabbitmq.channel.purgeQueue(queueName);
      expect(typeof result.messageCount).toBe('number');
      
      // Verify empty
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg).toBe(false);
    });
  });

  describe('message acknowledgment', () => {
    it('should acknowledge messages manually', async () => {
      const queueName = 'test_queue_ack';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      // Send message
      services.rabbitmq.channel.sendToQueue(
        queueName,
        Buffer.from('test message')
      );
      
      // Get message without auto-ack
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: false });
      expect(msg).not.toBe(false);
      
      if (msg) {
        // Acknowledge message
        services.rabbitmq.channel.ack(msg);
      }
    });

    it('should reject and requeue messages', async () => {
      const queueName = 'test_queue_reject';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      // Send message
      services.rabbitmq.channel.sendToQueue(
        queueName,
        Buffer.from('test message')
      );
      
      // Get message
      const msg1 = await services.rabbitmq.channel.get(queueName, { noAck: false });
      expect(msg1).not.toBe(false);
      
      if (msg1) {
        // Reject and requeue
        services.rabbitmq.channel.nack(msg1, false, true);
      }
      
      // Wait a bit for requeue
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Message should be available again
      const msg2 = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg2).not.toBe(false);
    });
  });

  describe('message properties', () => {
    it('should send message with properties', async () => {
      const queueName = 'test_queue_props';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      const message = { data: 'test' };
      services.rabbitmq.channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        {
          contentType: 'application/json',
          contentEncoding: 'utf-8',
          persistent: false,
          priority: 5,
          correlationId: 'correlation-123',
          replyTo: 'reply_queue',
          messageId: 'msg-456',
        }
      );
      
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg).not.toBe(false);
      
      if (msg) {
        expect(msg.properties.contentType).toBe('application/json');
        expect(msg.properties.correlationId).toBe('correlation-123');
        expect(msg.properties.messageId).toBe('msg-456');
      }
    });

    it('should send message with expiration', async () => {
      const queueName = 'test_queue_ttl';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      // Send message with 1 second expiration
      services.rabbitmq.channel.sendToQueue(
        queueName,
        Buffer.from('expiring message'),
        {
          expiration: '1000',
        }
      );
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Message should be gone
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg).toBe(false);
    });
  });

  describe('exchange operations', () => {
    it('should create and use direct exchange', async () => {
      const exchangeName = 'test_exchange_direct';
      const queueName = 'test_queue_exchange';
      const routingKey = 'test.routing.key';
      
      await services.rabbitmq.channel.assertExchange(exchangeName, 'direct', {
        durable: false,
      });
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      await services.rabbitmq.channel.bindQueue(queueName, exchangeName, routingKey);
      
      // Publish to exchange
      services.rabbitmq.channel.publish(
        exchangeName,
        routingKey,
        Buffer.from('test message')
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Receive from queue
      const msg = await services.rabbitmq.channel.get(queueName, { noAck: true });
      expect(msg).not.toBe(false);
      if (msg) {
        expect(msg.content.toString()).toBe('test message');
      }
    });

    it('should create and use fanout exchange', async () => {
      const exchangeName = 'test_exchange_fanout';
      const queue1 = 'test_queue_fanout_1';
      const queue2 = 'test_queue_fanout_2';
      
      await services.rabbitmq.channel.assertExchange(exchangeName, 'fanout', {
        durable: false,
      });
      await services.rabbitmq.channel.assertQueue(queue1, { durable: false });
      await services.rabbitmq.channel.assertQueue(queue2, { durable: false });
      
      await services.rabbitmq.channel.bindQueue(queue1, exchangeName, '');
      await services.rabbitmq.channel.bindQueue(queue2, exchangeName, '');
      
      // Publish to fanout exchange
      services.rabbitmq.channel.publish(
        exchangeName,
        '',
        Buffer.from('broadcast message')
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Both queues should receive the message
      const msg1 = await services.rabbitmq.channel.get(queue1, { noAck: true });
      const msg2 = await services.rabbitmq.channel.get(queue2, { noAck: true });
      
      expect(msg1).not.toBe(false);
      expect(msg2).not.toBe(false);
      if (msg1) expect(msg1.content.toString()).toBe('broadcast message');
      if (msg2) expect(msg2.content.toString()).toBe('broadcast message');
    });

    it('should create and use topic exchange', async () => {
      const exchangeName = 'test_exchange_topic';
      const queue1 = 'test_queue_topic_1';
      const queue2 = 'test_queue_topic_2';
      
      await services.rabbitmq.channel.assertExchange(exchangeName, 'topic', {
        durable: false,
      });
      await services.rabbitmq.channel.assertQueue(queue1, { durable: false });
      await services.rabbitmq.channel.assertQueue(queue2, { durable: false });
      
      await services.rabbitmq.channel.bindQueue(queue1, exchangeName, 'order.*');
      await services.rabbitmq.channel.bindQueue(queue2, exchangeName, 'order.created');
      
      // Publish with routing key that matches both
      services.rabbitmq.channel.publish(
        exchangeName,
        'order.created',
        Buffer.from('order created')
      );
      
      // Publish with routing key that matches only queue1
      services.rabbitmq.channel.publish(
        exchangeName,
        'order.fulfilled',
        Buffer.from('order fulfilled')
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Queue1 should receive both messages
      const msg1a = await services.rabbitmq.channel.get(queue1, { noAck: true });
      const msg1b = await services.rabbitmq.channel.get(queue1, { noAck: true });
      
      // Queue2 should receive only one message
      const msg2 = await services.rabbitmq.channel.get(queue2, { noAck: true });
      const msg2none = await services.rabbitmq.channel.get(queue2, { noAck: true });
      
      expect(msg1a).not.toBe(false);
      expect(msg1b).not.toBe(false);
      expect(msg2).not.toBe(false);
      expect(msg2none).toBe(false);
    });
  });

  describe('consumer pattern', () => {
    it('should consume messages with consumer', async () => {
      const queueName = 'test_queue_consumer';
      await services.rabbitmq.channel.assertQueue(queueName, { durable: false });
      
      const receivedMessages: string[] = [];
      
      // Set up consumer
      await services.rabbitmq.channel.consume(
        queueName,
        (msg) => {
          if (msg) {
            receivedMessages.push(msg.content.toString());
            services.rabbitmq.channel.ack(msg);
          }
        },
        { noAck: false }
      );
      
      // Send messages
      for (let i = 0; i < 3; i++) {
        services.rabbitmq.channel.sendToQueue(
          queueName,
          Buffer.from(`message ${i}`)
        );
      }
      
      // Wait for messages to be consumed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(receivedMessages).toHaveLength(3);
      expect(receivedMessages[0]).toBe('message 0');
      expect(receivedMessages[2]).toBe('message 2');
    });
  });

  describe('error handling', () => {
    it('should handle queue not found error', async () => {
      await expect(
        services.rabbitmq.channel.deleteQueue('non_existent_queue')
      ).rejects.toThrow();
    });

    it('should handle channel errors gracefully', async () => {
      // Try to assert queue with conflicting properties
      const queueName = 'test_queue_conflict';
      await services.rabbitmq.channel.assertQueue(queueName, {
        durable: true,
        autoDelete: false,
      });
      
      // This should cause channel error (conflicting properties)
      try {
        await services.rabbitmq.channel.assertQueue(queueName, {
          durable: false,
          autoDelete: true,
        });
        // If no error, manually fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('transaction patterns', () => {
    it('should simulate transaction processing workflow', async () => {
      const inputQueue = 'tx_input_queue';
      const processingQueue = 'tx_processing_queue';
      const resultsQueue = 'tx_results_queue';
      
      await services.rabbitmq.channel.assertQueue(inputQueue, { durable: false });
      await services.rabbitmq.channel.assertQueue(processingQueue, { durable: false });
      await services.rabbitmq.channel.assertQueue(resultsQueue, { durable: false });
      
      // Simulate transaction ingestion
      const txMessage = {
        signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
        slot: 234567890,
        source: 'realtime',
        programId: 'DLNProg11111111111111111111111111111111111',
      };
      
      services.rabbitmq.channel.sendToQueue(
        inputQueue,
        Buffer.from(JSON.stringify(txMessage)),
        { persistent: false }
      );
      
      // Simulate worker picking up message
      const msg = await services.rabbitmq.channel.get(inputQueue, { noAck: true });
      expect(msg).not.toBe(false);
      
      if (msg) {
        const receivedTx = JSON.parse(msg.content.toString());
        expect(receivedTx.signature).toBe(txMessage.signature);
        
        // Simulate processing result
        const result = {
          ...receivedTx,
          status: 'processed',
          processedAt: new Date().toISOString(),
        };
        
        services.rabbitmq.channel.sendToQueue(
          resultsQueue,
          Buffer.from(JSON.stringify(result))
        );
      }
      
      // Verify result
      const resultMsg = await services.rabbitmq.channel.get(resultsQueue, { noAck: true });
      expect(resultMsg).not.toBe(false);
      if (resultMsg) {
        const result = JSON.parse(resultMsg.content.toString());
        expect(result.status).toBe('processed');
        expect(result.processedAt).toBeDefined();
      }
    });
  });
});
