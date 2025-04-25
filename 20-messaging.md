# Messaging in Spring Boot 📨

## Overview

Master messaging patterns in Spring Boot applications. Learn about JMS, AMQP (RabbitMQ), Apache Kafka, WebSocket, and best practices for reliable message processing.

## Core Concepts

### 1. RabbitMQ Configuration

```java
@Configuration
public class RabbitMQConfig {
    @Value("${spring.rabbitmq.exchange}")
    private String exchange;

    @Value("${spring.rabbitmq.queues.notification}")
    private String notificationQueue;

    @Value("${spring.rabbitmq.queues.email}")
    private String emailQueue;

    @Value("${spring.rabbitmq.routing-keys.notification}")
    private String notificationRoutingKey;

    @Value("${spring.rabbitmq.routing-keys.email}")
    private String emailRoutingKey;

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(notificationQueue)
            .withArgument("x-dead-letter-exchange", exchange + ".dlx")
            .withArgument("x-dead-letter-routing-key", "dlx." + notificationRoutingKey)
            .build();
    }

    @Bean
    public Queue emailQueue() {
        return QueueBuilder.durable(emailQueue)
            .withArgument("x-dead-letter-exchange", exchange + ".dlx")
            .withArgument("x-dead-letter-routing-key", "dlx." + emailRoutingKey)
            .build();
    }

    @Bean
    public TopicExchange exchange() {
        return new TopicExchange(exchange);
    }

    @Bean
    public Binding notificationBinding() {
        return BindingBuilder
            .bind(notificationQueue())
            .to(exchange())
            .with(notificationRoutingKey);
    }

    @Bean
    public Binding emailBinding() {
        return BindingBuilder
            .bind(emailQueue())
            .to(exchange())
            .with(emailRoutingKey);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter());
        return rabbitTemplate;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());
        factory.setConcurrentConsumers(3);
        factory.setMaxConcurrentConsumers(10);
        return factory;
    }
}
```

### 2. Kafka Configuration

```java
@Configuration
@EnableKafka
public class KafkaConfig {
    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        config.put(ProducerConfig.ACKS_CONFIG, "all");
        config.put(ProducerConfig.RETRIES_CONFIG, 3);
        config.put(ProducerConfig.RETRY_BACKOFF_MS_CONFIG, 1000);

        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    @Bean
    public ConsumerFactory<String, Object> consumerFactory() {
        Map<String, Object> config = new HashMap<>();
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ConsumerConfig.GROUP_ID_CONFIG, "my-group");
        config.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        config.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        config.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        config.put(JsonDeserializer.TRUSTED_PACKAGES, "*");

        return new DefaultKafkaConsumerFactory<>(config);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
            new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL_IMMEDIATE);
        factory.setErrorHandler(new SeekToCurrentErrorHandler());
        return factory;
    }
}
```

### 3. WebSocket Configuration

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOrigins("*")
            .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(8192)
            .setSendBufferSizeLimit(8192)
            .setSendTimeLimit(10000);
    }
}
```

## Real-World Examples

### 1. Event-Driven Order Processing

```java
@Service
@Slf4j
public class OrderProcessor {
    private final RabbitTemplate rabbitTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final SimpMessagingTemplate webSocketTemplate;

    @RabbitListener(queues = "${spring.rabbitmq.queues.order}")
    public void processOrder(Order order, Message message, Channel channel) throws IOException {
        try {
            log.info("Processing order: {}", order.getId());

            // Process the order
            OrderResult result = processOrderLogic(order);

            // Send notification via Kafka
            kafkaTemplate.send("notifications", result);

            // Send real-time update via WebSocket
            webSocketTemplate.convertAndSendToUser(
                order.getUserId(),
                "/queue/orders",
                new OrderStatusUpdate(order.getId(), "PROCESSED")
            );

            // Acknowledge the message
            channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);

        } catch (Exception e) {
            log.error("Error processing order: {}", order.getId(), e);
            // Reject and requeue the message
            channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true);
        }
    }

    @KafkaListener(topics = "order-events", groupId = "order-processor")
    public void handleOrderEvent(ConsumerRecord<String, OrderEvent> record,
                               Acknowledgment ack) {
        try {
            OrderEvent event = record.value();
            log.info("Received order event: {}", event);

            // Process the event
            processOrderEvent(event);

            // Acknowledge the message
            ack.acknowledge();

        } catch (Exception e) {
            log.error("Error processing order event", e);
            // The message will be retried due to manual acknowledgment
        }
    }

    private OrderResult processOrderLogic(Order order) {
        // Implementation of order processing logic
        return new OrderResult(order.getId(), "SUCCESS");
    }

    private void processOrderEvent(OrderEvent event) {
        // Implementation of order event processing
    }
}
```

### 2. Real-Time Notification System

```java
@Service
@Slf4j
public class NotificationService {
    private final SimpMessagingTemplate webSocketTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final NotificationRepository notificationRepository;

    @RabbitListener(queues = "${spring.rabbitmq.queues.notification}")
    public void handleNotification(NotificationMessage notification, Message message,
                                 Channel channel) throws IOException {
        try {
            log.info("Processing notification: {}", notification.getId());

            // Save notification to database
            Notification savedNotification = saveNotification(notification);

            // Send to connected WebSocket clients
            sendToWebSocket(savedNotification);

            // Acknowledge the message
            channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);

        } catch (Exception e) {
            log.error("Error processing notification", e);
            // Reject and requeue the message
            channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true);
        }
    }

    public void sendNotification(String userId, NotificationType type, String content) {
        NotificationMessage notification = new NotificationMessage(
            UUID.randomUUID().toString(),
            userId,
            type,
            content,
            LocalDateTime.now()
        );

        // Send to RabbitMQ for processing
        rabbitTemplate.convertAndSend(
            "notifications.exchange",
            "notifications.create",
            notification
        );
    }

    private Notification saveNotification(NotificationMessage message) {
        Notification notification = new Notification();
        notification.setUserId(message.getUserId());
        notification.setType(message.getType());
        notification.setContent(message.getContent());
        notification.setCreatedAt(message.getTimestamp());
        return notificationRepository.save(notification);
    }

    private void sendToWebSocket(Notification notification) {
        webSocketTemplate.convertAndSendToUser(
            notification.getUserId(),
            "/queue/notifications",
            NotificationDTO.from(notification)
        );
    }
}
```

### 3. Distributed Event Processing

```java
@Service
@Slf4j
public class EventProcessor {
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final EventRepository eventRepository;
    private final MetricsService metricsService;

    @KafkaListener(
        topics = "events",
        groupId = "event-processor",
        containerFactory = "kafkaListenerContainerFactory"
    )
    public void processEvent(ConsumerRecord<String, Event> record,
                           Acknowledgment ack) {
        String eventId = record.key();
        Event event = record.value();

        try {
            log.info("Processing event: {}", eventId);

            // Process the event
            EventResult result = processEventLogic(event);

            // Save the result
            saveEventResult(result);

            // Update metrics
            metricsService.recordEventProcessing(event.getType(), result.getStatus());

            // Send follow-up event if needed
            if (result.requiresFollowUp()) {
                sendFollowUpEvent(result);
            }

            // Acknowledge the message
            ack.acknowledge();

        } catch (Exception e) {
            log.error("Error processing event: {}", eventId, e);
            // The message will be retried due to manual acknowledgment
            metricsService.recordEventError(event.getType());
        }
    }

    private EventResult processEventLogic(Event event) {
        // Implementation of event processing logic
        return new EventResult(event.getId(), "PROCESSED");
    }

    private void saveEventResult(EventResult result) {
        EventProcessingRecord record = new EventProcessingRecord();
        record.setEventId(result.getEventId());
        record.setStatus(result.getStatus());
        record.setProcessedAt(LocalDateTime.now());
        eventRepository.save(record);
    }

    private void sendFollowUpEvent(EventResult result) {
        FollowUpEvent followUpEvent = new FollowUpEvent(
            result.getEventId(),
            "FOLLOW_UP",
            result.getMetadata()
        );

        kafkaTemplate.send("follow-up-events", followUpEvent.getId(), followUpEvent)
            .addCallback(
                success -> log.info("Follow-up event sent: {}", followUpEvent.getId()),
                failure -> log.error("Failed to send follow-up event", failure)
            );
    }
}
```

## Common Pitfalls

1. ❌ Not handling message failures
   ✅ Implement proper error handling and retries

2. ❌ Missing message validation
   ✅ Validate messages before processing

3. ❌ Poor monitoring
   ✅ Implement comprehensive monitoring

4. ❌ Inconsistent message formats
   ✅ Use standardized message formats

## Best Practices

1. Use appropriate message brokers
2. Implement proper error handling
3. Set up message validation
4. Configure message persistence
5. Implement monitoring
6. Use dead letter queues
7. Handle duplicate messages
8. Implement circuit breakers

## Knowledge Check

- [ ] Configure message brokers
- [ ] Implement message listeners
- [ ] Set up error handling
- [ ] Use WebSocket
- [ ] Monitor message processing
- [ ] Handle failed messages

## Additional Resources

- [Spring AMQP Documentation](https://docs.spring.io/spring-amqp/docs/current/reference/html/)
- [Spring for Apache Kafka](https://docs.spring.io/spring-kafka/docs/current/reference/html/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)

---

⬅️ Previous: [Caching](./19-caching.md)

➡️ Next: [Batch Processing](./21-batch-processing.md)