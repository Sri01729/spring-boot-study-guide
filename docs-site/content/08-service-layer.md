# Service Layer & Dependency Injection 🔄

## Overview

Master Spring Boot's service layer architecture and dependency injection patterns. Learn how to structure business logic, manage dependencies, and create maintainable, testable services.

## Core Concepts

### Service Layer Components
```java
@Service               // Business logic
@Component             // Generic Spring beans
@Repository            // Data access
@Configuration         // Configuration classes
@Bean                  // Manual bean definition
```

### Dependency Injection Types
```java
// Constructor Injection (Recommended)
@Autowired
public UserService(UserRepository repository) { }

// Setter Injection
@Autowired
public void setRepository(UserRepository repository) { }

// Field Injection (Not Recommended)
@Autowired
private UserRepository repository;
```

## Real-World Examples

### 1. Service Layer Architecture

```java
@Service
@Transactional
@Slf4j
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductService productService;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final OrderMapper orderMapper;

    public OrderService(
        OrderRepository orderRepository,
        ProductService productService,
        PaymentService paymentService,
        NotificationService notificationService,
        OrderMapper orderMapper
    ) {
        this.orderRepository = orderRepository;
        this.productService = productService;
        this.paymentService = paymentService;
        this.notificationService = notificationService;
        this.orderMapper = orderMapper;
    }

    public OrderDTO createOrder(OrderRequest request) {
        // Validate products availability
        validateProductsAvailability(request.getItems());

        // Calculate total amount
        BigDecimal totalAmount = calculateTotalAmount(request.getItems());

        // Create order entity
        Order order = Order.builder()
            .customerId(request.getCustomerId())
            .items(orderMapper.toOrderItems(request.getItems()))
            .totalAmount(totalAmount)
            .status(OrderStatus.PENDING)
            .build();

        // Save order
        order = orderRepository.save(order);
        log.info("Created order: {}", order.getId());

        // Process payment
        PaymentResult payment = paymentService.processPayment(
            order.getId(),
            totalAmount,
            request.getPaymentDetails()
        );

        // Update order status
        order.setStatus(payment.isSuccessful()
            ? OrderStatus.CONFIRMED
            : OrderStatus.PAYMENT_FAILED);
        order = orderRepository.save(order);

        // Send notification
        if (payment.isSuccessful()) {
            notificationService.sendOrderConfirmation(order);
            updateInventory(order.getItems());
        }

        return orderMapper.toDTO(order);
    }

    private void validateProductsAvailability(List<OrderItemRequest> items) {
        for (OrderItemRequest item : items) {
            ProductDTO product = productService.getProduct(item.getProductId());
            if (product.getStockQuantity() < item.getQuantity()) {
                throw new InsufficientStockException(
                    "Insufficient stock for product: " + product.getName()
                );
            }
        }
    }

    private BigDecimal calculateTotalAmount(List<OrderItemRequest> items) {
        return items.stream()
            .map(item -> {
                ProductDTO product = productService.getProduct(item.getProductId());
                return product.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            })
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void updateInventory(List<OrderItem> items) {
        items.forEach(item ->
            productService.updateStock(
                item.getProductId(),
                item.getQuantity()
            )
        );
    }
}
```

### 2. Dependency Injection Patterns

```java
@Configuration
public class ServiceConfig {

    @Bean
    public PaymentService paymentService(
        PaymentGateway gateway,
        @Value("${payment.retry.attempts}") int retryAttempts,
        @Value("${payment.timeout}") Duration timeout
    ) {
        return new PaymentServiceImpl(gateway, retryAttempts, timeout);
    }

    @Bean
    @Profile("production")
    public PaymentGateway productionPaymentGateway(
        @Value("${payment.api.key}") String apiKey,
        @Value("${payment.api.secret}") String apiSecret
    ) {
        return new StripePaymentGateway(apiKey, apiSecret);
    }

    @Bean
    @Profile("development")
    public PaymentGateway sandboxPaymentGateway() {
        return new SandboxPaymentGateway();
    }
}

@Service
public class PaymentServiceImpl implements PaymentService {
    private final PaymentGateway gateway;
    private final int retryAttempts;
    private final Duration timeout;

    public PaymentServiceImpl(
        PaymentGateway gateway,
        int retryAttempts,
        Duration timeout
    ) {
        this.gateway = gateway;
        this.retryAttempts = retryAttempts;
        this.timeout = timeout;
    }

    @Override
    public PaymentResult processPayment(
        Long orderId,
        BigDecimal amount,
        PaymentDetails details
    ) {
        return RetryTemplate.builder()
            .maxAttempts(retryAttempts)
            .fixedBackoff(timeout.toMillis())
            .build()
            .execute(context -> gateway.processPayment(
                PaymentRequest.builder()
                    .orderId(orderId)
                    .amount(amount)
                    .details(details)
                    .build()
            ));
    }
}
```

### 3. Service Layer Testing

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ProductService productService;

    @Mock
    private PaymentService paymentService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private OrderMapper orderMapper;

    @InjectMocks
    private OrderService orderService;

    @Test
    void createOrder_Success() {
        // Arrange
        OrderRequest request = createSampleOrderRequest();
        Order order = createSampleOrder();
        OrderDTO orderDTO = createSampleOrderDTO();

        when(productService.getProduct(anyLong()))
            .thenReturn(createSampleProduct());
        when(orderRepository.save(any(Order.class)))
            .thenReturn(order);
        when(paymentService.processPayment(
            anyLong(), any(BigDecimal.class), any(PaymentDetails.class)
        )).thenReturn(PaymentResult.success());
        when(orderMapper.toDTO(any(Order.class)))
            .thenReturn(orderDTO);

        // Act
        OrderDTO result = orderService.createOrder(request);

        // Assert
        assertNotNull(result);
        assertEquals(orderDTO.getId(), result.getId());
        verify(notificationService).sendOrderConfirmation(order);
        verify(productService).updateStock(anyLong(), anyInt());
    }

    @Test
    void createOrder_InsufficientStock() {
        // Arrange
        OrderRequest request = createSampleOrderRequest();
        ProductDTO product = createProductWithLowStock();

        when(productService.getProduct(anyLong()))
            .thenReturn(product);

        // Act & Assert
        assertThrows(
            InsufficientStockException.class,
            () -> orderService.createOrder(request)
        );

        verify(orderRepository, never()).save(any(Order.class));
        verify(paymentService, never()).processPayment(
            anyLong(), any(BigDecimal.class), any(PaymentDetails.class)
        );
    }
}
```

### 4. Aspect-Oriented Programming (AOP)

```java
@Aspect
@Component
@Slf4j
public class ServiceLoggingAspect {

    @Around("@within(org.springframework.stereotype.Service)")
    public Object logServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();

        log.info("Executing {}.{} with parameters: {}",
            className, methodName, Arrays.toString(joinPoint.getArgs()));

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startTime;

            log.info("{}.{} completed in {}ms", className, methodName, duration);
            return result;
        } catch (Exception e) {
            log.error("{}.{} failed with error: {}",
                className, methodName, e.getMessage());
            throw e;
        }
    }
}

@Aspect
@Component
public class TransactionRetryAspect {

    @Around("@annotation(Retryable)")
    public Object retryOnFailure(ProceedingJoinPoint joinPoint) throws Throwable {
        Retryable retryable = ((MethodSignature) joinPoint.getSignature())
            .getMethod()
            .getAnnotation(Retryable.class);

        int maxAttempts = retryable.maxAttempts();
        long backoff = retryable.backoff();

        Exception lastException = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return joinPoint.proceed();
            } catch (Exception e) {
                lastException = e;
                if (attempt < maxAttempts) {
                    Thread.sleep(backoff * attempt);
                }
            }
        }
        throw lastException;
    }
}
```

## Common Pitfalls

1. ❌ Field injection
   ✅ Use constructor injection

2. ❌ Circular dependencies
   ✅ Redesign service relationships

3. ❌ Business logic in controllers
   ✅ Move to service layer

4. ❌ Not using interfaces
   ✅ Program to interfaces

## Best Practices

1. Use constructor injection
2. Keep services focused (SRP)
3. Use proper transaction boundaries
4. Implement proper error handling
5. Write unit tests
6. Use meaningful logging
7. Handle dependencies properly
8. Use AOP for cross-cutting concerns

## Knowledge Check

- [ ] Explain dependency injection
- [ ] Implement service layer
- [ ] Use constructor injection
- [ ] Write service tests
- [ ] Handle transactions
- [ ] Use AOP effectively

## Additional Resources

- [Spring IoC Container](https://docs.spring.io/spring-framework/reference/core/beans/introduction.html)
- [Spring AOP](https://docs.spring.io/spring-framework/reference/core/aop.html)
- [Testing Spring Boot](https://spring.io/guides/gs/testing-web/)
- [Transaction Management](https://docs.spring.io/spring-framework/reference/data-access/transaction.html)

---

⬅️ Previous: [Handling Query Params and Request Bodies](./07-request-handling.md)

➡️ Next: [Spring Data JPA](./09-spring-data-jpa.md)