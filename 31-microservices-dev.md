# Microservices Development with Spring Boot 🔨

## Overview

Master the development of microservices using Spring Boot. Learn about service design, implementation patterns, testing strategies, and deployment considerations.

## Core Concepts

### 1. Service Structure

```java
@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }

    @Bean
    public ModelMapper modelMapper() {
        return new ModelMapper();
    }
}

application.yml:
```yaml
spring:
  application:
    name: order-service
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: order-service
      auto-offset-reset: earliest

server:
  port: 0  # Random port for multiple instances

eureka:
  instance:
    instance-id: ${spring.application.name}:${random.uuid}
```

### 2. Domain-Driven Design

```java
@Aggregate
@Entity
@Table(name = "orders")
public class Order {
    @AggregateIdentifier
    @Id
    private String id;

    @Column(nullable = false)
    private String customerId;

    @ElementCollection
    @CollectionTable(name = "order_items")
    private List<OrderItem> items;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Version
    private Long version;

    @CommandHandler
    public Order(CreateOrderCommand command) {
        apply(new OrderCreatedEvent(command.getOrderId(),
            command.getCustomerId(),
            command.getItems()));
    }

    @EventSourcingHandler
    public void on(OrderCreatedEvent event) {
        this.id = event.getOrderId();
        this.customerId = event.getCustomerId();
        this.items = event.getItems();
        this.status = OrderStatus.CREATED;
    }

    @CommandHandler
    public void handle(ConfirmOrderCommand command) {
        if (status != OrderStatus.CREATED) {
            throw new IllegalStateException(
                "Order cannot be confirmed");
        }
        apply(new OrderConfirmedEvent(id));
    }

    @EventSourcingHandler
    public void on(OrderConfirmedEvent event) {
        this.status = OrderStatus.CONFIRMED;
    }
}
```

### 3. Service Communication

```java
@FeignClient(name = "inventory-service",
    fallback = InventoryServiceFallback.class)
public interface InventoryServiceClient {
    @GetMapping("/api/v1/inventory/{productId}")
    Mono<InventoryResponse> checkInventory(
        @PathVariable String productId);
}

@Service
@Slf4j
public class OrderProcessor {
    private final InventoryServiceClient inventoryService;
    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public Mono<OrderResponse> processOrder(OrderRequest request) {
        return validateInventory(request)
            .flatMap(this::createOrder)
            .doOnSuccess(order ->
                publishOrderEvent(order, "ORDER_CREATED"))
            .map(this::toOrderResponse)
            .doOnError(e ->
                log.error("Order processing failed", e));
    }

    private Mono<OrderRequest> validateInventory(
            OrderRequest request) {
        return Flux.fromIterable(request.getItems())
            .flatMap(item ->
                inventoryService.checkInventory(item.getProductId())
                    .filter(response ->
                        response.getQuantity() >= item.getQuantity())
                    .switchIfEmpty(Mono.error(
                        new InsufficientInventoryException(
                            item.getProductId()))))
            .then(Mono.just(request));
    }

    private void publishOrderEvent(Order order, String type) {
        OrderEvent event = new OrderEvent(
            order.getId(),
            type,
            LocalDateTime.now());

        kafkaTemplate.send("orders",
            order.getId(),
            event)
            .addCallback(
                result -> log.debug("Event published: {}", event),
                ex -> log.error("Failed to publish event", ex));
    }
}
```

## Real-World Examples

### 1. Event-Driven Order Processing

```java
@Service
@Slf4j
public class OrderEventProcessor {
    private final OrderRepository orderRepository;
    private final PaymentServiceClient paymentService;
    private final ShippingServiceClient shippingService;
    private final NotificationService notificationService;

    @KafkaListener(topics = "orders")
    public void handleOrderEvent(OrderEvent event) {
        log.info("Processing order event: {}", event);

        switch (event.getType()) {
            case "ORDER_CREATED":
                processNewOrder(event);
                break;
            case "PAYMENT_COMPLETED":
                initiateShipping(event);
                break;
            case "SHIPPING_INITIATED":
                updateOrderStatus(event);
                break;
            default:
                log.warn("Unknown event type: {}", event.getType());
        }
    }

    private void processNewOrder(OrderEvent event) {
        Order order = orderRepository
            .findById(event.getOrderId())
            .orElseThrow(() -> new OrderNotFoundException(
                event.getOrderId()));

        paymentService.processPayment(
            new PaymentRequest(order))
            .subscribe(
                response -> log.info(
                    "Payment initiated for order: {}",
                    order.getId()),
                error -> handlePaymentError(order, error));
    }

    private void initiateShipping(OrderEvent event) {
        Order order = orderRepository
            .findById(event.getOrderId())
            .orElseThrow(() -> new OrderNotFoundException(
                event.getOrderId()));

        shippingService.initiateShipping(
            new ShippingRequest(order))
            .subscribe(
                response -> {
                    order.setStatus(OrderStatus.SHIPPING);
                    orderRepository.save(order);
                    notifyCustomer(order, "Shipping initiated");
                },
                error -> handleShippingError(order, error));
    }

    private void notifyCustomer(Order order, String message) {
        NotificationRequest request = NotificationRequest.builder()
            .customerId(order.getCustomerId())
            .type(NotificationType.ORDER_UPDATE)
            .message(message)
            .orderId(order.getId())
            .build();

        notificationService.sendNotification(request)
            .subscribe(
                null,
                error -> log.error(
                    "Failed to send notification", error));
    }
}
```

### 2. Distributed Transaction Management

```java
@Service
@Slf4j
public class OrderTransactionManager {
    private final OrderRepository orderRepository;
    private final InventoryServiceClient inventoryService;
    private final PaymentServiceClient paymentService;
    private final TransactionEventPublisher eventPublisher;

    @Transactional
    public Mono<OrderResponse> createOrder(OrderRequest request) {
        return Mono.just(request)
            .flatMap(this::reserveInventory)
            .flatMap(this::processPayment)
            .flatMap(this::finalizeOrder)
            .onErrorResume(this::handleTransactionError);
    }

    private Mono<OrderContext> reserveInventory(
            OrderRequest request) {
        return inventoryService.reserve(
            toInventoryRequest(request))
            .map(response -> new OrderContext(
                request, response.getReservationId()));
    }

    private Mono<OrderContext> processPayment(
            OrderContext context) {
        return paymentService.authorize(
            toPaymentRequest(context))
            .map(response -> context.withPaymentId(
                response.getTransactionId()));
    }

    private Mono<OrderResponse> finalizeOrder(
            OrderContext context) {
        Order order = createOrderEntity(context);
        orderRepository.save(order);

        return Mono.just(toOrderResponse(order))
            .doOnSuccess(response ->
                publishTransactionComplete(context));
    }

    private Mono<OrderResponse> handleTransactionError(
            Throwable error) {
        log.error("Transaction failed", error);

        if (error instanceof InventoryException) {
            return compensateInventory()
                .then(Mono.error(error));
        }

        if (error instanceof PaymentException) {
            return compensatePayment()
                .then(compensateInventory())
                .then(Mono.error(error));
        }

        return Mono.error(error);
    }

    private void publishTransactionComplete(
            OrderContext context) {
        TransactionEvent event = TransactionEvent.builder()
            .orderId(context.getOrderId())
            .inventoryReservationId(
                context.getReservationId())
            .paymentTransactionId(context.getPaymentId())
            .status(TransactionStatus.COMPLETED)
            .timestamp(LocalDateTime.now())
            .build();

        eventPublisher.publish(event)
            .subscribe(
                null,
                error -> log.error(
                    "Failed to publish transaction event",
                    error));
    }
}
```

### 3. Service Testing

```java
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:test.properties")
class OrderServiceIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrderRepository orderRepository;

    @MockBean
    private InventoryServiceClient inventoryService;

    @MockBean
    private PaymentServiceClient paymentService;

    @Test
    void createOrder_Success() throws Exception {
        // Given
        OrderRequest request = createOrderRequest();
        given(inventoryService.checkInventory(any()))
            .willReturn(Mono.just(new InventoryResponse(true)));
        given(paymentService.authorize(any()))
            .willReturn(Mono.just(new PaymentResponse("tx123")));

        // When
        ResultActions result = mockMvc.perform(post("/api/v1/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(request)));

        // Then
        result.andExpect(status().isCreated())
            .andExpect(jsonPath("$.orderId").exists())
            .andExpect(jsonPath("$.status")
                .value("CREATED"));

        verify(inventoryService).checkInventory(any());
        verify(paymentService).authorize(any());
    }

    @Test
    void createOrder_InsufficientInventory() throws Exception {
        // Given
        OrderRequest request = createOrderRequest();
        given(inventoryService.checkInventory(any()))
            .willReturn(Mono.just(new InventoryResponse(false)));

        // When
        ResultActions result = mockMvc.perform(post("/api/v1/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(request)));

        // Then
        result.andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error")
                .value("Insufficient inventory"));

        verify(inventoryService).checkInventory(any());
        verify(paymentService, never()).authorize(any());
    }
}
```

## Common Pitfalls

1. ❌ Tight coupling between services
   ✅ Use event-driven architecture

2. ❌ Monolithic thinking
   ✅ Design for distribution

3. ❌ Poor error handling
   ✅ Implement resilience patterns

4. ❌ Insufficient testing
   ✅ Comprehensive testing strategy

# Things to Avoid During Microservices Implementation

## 1. Avoid Overengineering
- Do not split services too finely without a strong reason.
- Keep services cohesive and meaningful.

## 2. Avoid Tight Coupling
- Services should communicate via APIs or messaging, not through direct internals.
- No direct database sharing between services.

## 3. Avoid Database Sharing
- Each microservice must have its own separate database.
- No two services should directly access the same data store.

## 4. Avoid Ignoring Observability
- Implement centralized logging, metrics, and distributed tracing.
- Make sure every service can be monitored individually.

## 5. Avoid Poor API Design
- Always version your APIs.
- Never introduce breaking changes without careful planning.

## 6. Avoid Synchronous Communication Everywhere
- Too many synchronous calls cause latency and cascading failures.
- Prefer asynchronous communication (message queues, event buses).

## 7. Avoid Lack of Fault Tolerance
- Microservices must be resilient to failures.
- Use retries, timeouts, circuit breakers, and fallback mechanisms.

## 8. Avoid Monolithic Deployment
- Deploy services independently, not bundled together.
- Independent deployment ensures flexibility and scalability.

## 9. Avoid Ignoring Security
- Protect internal service communication (e.g., mTLS, OAuth2).
- Always validate incoming requests, even from "trusted" sources.

## 10. Avoid Overlooking Data Consistency
- Accept that eventual consistency is part of microservices.
- Use patterns like Sagas or event-driven architecture for distributed transactions.

## 11. Avoid Skipping Automation
- Automate builds, testing, deployments, and monitoring.
- Manual processes introduce errors and slow down scaling.

## 12. Avoid Unclear Service Boundaries
- Clearly define service responsibilities.
- Avoid duplication or overlap between services.

## Best Practices

1. Follow DDD principles
2. Use event-driven patterns
3. Implement proper testing
4. Handle distributed transactions
5. Design for failure
6. Document APIs
7. Monitor service health
8. Version your APIs

## Knowledge Check

- [ ] Design service boundaries
- [ ] Implement DDD patterns
- [ ] Handle distributed transactions
- [ ] Write integration tests
- [ ] Implement event-driven patterns
- [ ] Document APIs

## Additional Resources

- [Spring Boot Testing](https://docs.spring.io/spring-boot/docs/current/reference/html/spring-boot-features.html#boot-features-testing)
- [Event-Driven Architecture](https://microservices.io/patterns/data/event-driven-architecture.html)
- [Domain-Driven Design](https://domainlanguage.com/ddd/)
- [Microservices Testing Strategies](https://martinfowler.com/articles/microservice-testing/)

---

⬅️ Previous: [Spring Cloud](./30-spring-cloud.md)

➡️ Next: [Docker](./32-docker.md)