# Spring Boot Best Practices 🎯

## Overview

Master the best practices for developing, testing, and deploying Spring Boot applications. Learn patterns, anti-patterns, and proven strategies for building robust applications.

## Core Concepts

### 1. Application Structure

```java
// com.example.myapp.config.ApplicationConfig.java
@Configuration
@EnableCaching
@EnableAsync
public class ApplicationConfig {

    @Bean
    public AsyncTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("async-");
        return executor;
    }

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(1, TimeUnit.HOURS)
            .maximumSize(100));
        return cacheManager;
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(5))
            .build();
    }
}

// com.example.myapp.exception.GlobalExceptionHandler.java
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception ex, WebRequest request) {
        log.error("Unhandled exception", ex);
        ErrorResponse error = new ErrorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            "An unexpected error occurred",
            request.getDescription(false)
        );
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex, WebRequest request) {
        List<String> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.toList());

        ErrorResponse error = new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation failed",
            errors
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }
}

// com.example.myapp.service.BaseService.java
@Service
public abstract class BaseService<T, ID> {

    @Autowired
    protected JpaRepository<T, ID> repository;

    @Transactional(readOnly = true)
    public Optional<T> findById(ID id) {
        return repository.findById(id);
    }

    @Transactional
    public T save(T entity) {
        return repository.save(entity);
    }

    @Transactional
    public void delete(ID id) {
        repository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Page<T> findAll(Pageable pageable) {
        return repository.findAll(pageable);
    }
}

// com.example.myapp.util.ValidationUtils.java
public final class ValidationUtils {

    private ValidationUtils() {
        throw new AssertionError("Utility class should not be instantiated");
    }

    public static void validatePageRequest(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must be greater than or equal to zero");
        }
        if (size < 1) {
            throw new IllegalArgumentException("Page size must be greater than zero");
        }
        if (size > 100) {
            throw new IllegalArgumentException("Page size must not be greater than 100");
        }
    }

    public static void validateId(Object id) {
        if (id == null) {
            throw new IllegalArgumentException("ID must not be null");
        }
    }
}
```

### 2. Testing Best Practices

```java
// com.example.myapp.service.UserServiceTest.java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @Test
    void createUser_WithValidData_ShouldSucceed() {
        // Arrange
        UserDto userDto = new UserDto("john@example.com", "password");
        User user = new User();
        user.setEmail(userDto.getEmail());

        when(passwordEncoder.encode(userDto.getPassword()))
            .thenReturn("encodedPassword");
        when(userRepository.save(any(User.class)))
            .thenReturn(user);

        // Act
        User result = userService.createUser(userDto);

        // Assert
        assertNotNull(result);
        assertEquals(userDto.getEmail(), result.getEmail());
        verify(passwordEncoder).encode(userDto.getPassword());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void createUser_WithExistingEmail_ShouldThrowException() {
        // Arrange
        UserDto userDto = new UserDto("john@example.com", "password");
        when(userRepository.findByEmail(userDto.getEmail()))
            .thenReturn(Optional.of(new User()));

        // Act & Assert
        assertThrows(UserAlreadyExistsException.class,
            () -> userService.createUser(userDto));
    }
}

// com.example.myapp.controller.UserControllerTest.java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void createUser_WithValidData_ShouldReturnCreated() throws Exception {
        // Arrange
        UserDto userDto = new UserDto("john@example.com", "password");
        User user = new User();
        user.setEmail(userDto.getEmail());

        when(userService.createUser(any(UserDto.class)))
            .thenReturn(user);

        // Act & Assert
        mockMvc.perform(post("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(new ObjectMapper().writeValueAsString(userDto)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value(userDto.getEmail()));
    }
}

// com.example.myapp.integration.UserIntegrationTest.java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = "classpath:application-test.yml")
@AutoConfigureTestDatabase
class UserIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setup() {
        userRepository.deleteAll();
    }

    @Test
    void createUser_WithValidData_ShouldSucceed() {
        // Arrange
        UserDto userDto = new UserDto("john@example.com", "password");

        // Act
        ResponseEntity<User> response = restTemplate.postForEntity(
            "/api/users",
            userDto,
            User.class
        );

        // Assert
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(userDto.getEmail(), response.getBody().getEmail());
        assertTrue(userRepository.findByEmail(userDto.getEmail()).isPresent());
    }
}
```

## Real-World Examples

### 1. Service Layer Implementation

```java
// com.example.myapp.service.OrderService.java
@Service
@Transactional
@Slf4j
public class OrderService extends BaseService<Order, Long> {

    private final ProductService productService;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final OrderMapper orderMapper;

    public OrderService(
            OrderRepository orderRepository,
            ProductService productService,
            PaymentService paymentService,
            NotificationService notificationService,
            OrderMapper orderMapper) {
        this.repository = orderRepository;
        this.productService = productService;
        this.paymentService = paymentService;
        this.notificationService = notificationService;
        this.orderMapper = orderMapper;
    }

    @Transactional
    public OrderResponse createOrder(OrderRequest request) {
        log.info("Creating order for user: {}", request.getUserId());

        // Validate products
        List<Product> products = productService.validateAndGetProducts(
            request.getProductIds()
        );

        // Calculate total
        BigDecimal total = calculateTotal(products);

        // Create order
        Order order = orderMapper.toEntity(request);
        order.setTotal(total);
        order.setStatus(OrderStatus.PENDING);
        order = repository.save(order);

        try {
            // Process payment
            PaymentResponse payment = paymentService.processPayment(
                new PaymentRequest(order.getId(), total)
            );

            if (payment.isSuccessful()) {
                order.setStatus(OrderStatus.COMPLETED);
                order = repository.save(order);

                // Send notification asynchronously
                notificationService.sendOrderConfirmation(order);
            } else {
                throw new PaymentFailedException("Payment failed for order: " + order.getId());
            }
        } catch (Exception e) {
            log.error("Error processing order: {}", order.getId(), e);
            order.setStatus(OrderStatus.FAILED);
            repository.save(order);
            throw new OrderProcessingException("Failed to process order", e);
        }

        return orderMapper.toResponse(order);
    }

    @Cacheable(value = "orders", key = "#userId")
    @Transactional(readOnly = true)
    public Page<OrderResponse> getUserOrders(Long userId, Pageable pageable) {
        log.debug("Fetching orders for user: {}", userId);
        return repository.findByUserId(userId, pageable)
            .map(orderMapper::toResponse);
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    @Transactional
    public void processFailedOrders() {
        log.info("Processing failed orders");
        List<Order> failedOrders = repository.findByStatus(OrderStatus.FAILED);

        for (Order order : failedOrders) {
            try {
                retryOrder(order);
            } catch (Exception e) {
                log.error("Failed to retry order: {}", order.getId(), e);
            }
        }
    }

    private BigDecimal calculateTotal(List<Product> products) {
        return products.stream()
            .map(Product::getPrice)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
```

### 2. Controller Implementation

```java
// com.example.myapp.controller.OrderController.java
@RestController
@RequestMapping("/api/orders")
@Validated
@Slf4j
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(
            @Valid @RequestBody OrderRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Creating order for user: {}", userDetails.getUsername());
        return orderService.createOrder(request);
    }

    @GetMapping
    public Page<OrderResponse> getUserOrders(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String[] sort) {
        log.debug("Fetching orders for user: {}", userDetails.getUsername());

        ValidationUtils.validatePageRequest(page, size);
        Pageable pageable = PageRequest.of(
            page,
            size,
            Sort.by(OrderUtils.parseSort(sort))
        );

        return orderService.getUserOrders(
            UserUtils.getUserId(userDetails),
            pageable
        );
    }

    @GetMapping("/{id}")
    public OrderResponse getOrder(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Fetching order: {}", id);

        return orderService.findById(id)
            .map(order -> {
                if (!order.getUserId().equals(UserUtils.getUserId(userDetails))) {
                    throw new AccessDeniedException("Access denied");
                }
                return orderMapper.toResponse(order);
            })
            .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }
}
```

### 3. Repository Implementation

```java
// com.example.myapp.repository.OrderRepository.java
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("""
        SELECT o FROM Order o
        WHERE o.userId = :userId
        AND o.status IN :statuses
        AND o.createdAt >= :startDate
        """)
    Page<Order> findByUserIdAndStatusAndCreatedAtAfter(
        @Param("userId") Long userId,
        @Param("statuses") Set<OrderStatus> statuses,
        @Param("startDate") LocalDateTime startDate,
        Pageable pageable
    );

    @Query(value = """
        SELECT DATE(o.created_at) as date,
               COUNT(*) as total,
               SUM(o.total) as revenue
        FROM orders o
        WHERE o.status = 'COMPLETED'
        AND o.created_at >= :startDate
        GROUP BY DATE(o.created_at)
        ORDER BY date DESC
        """,
        nativeQuery = true)
    List<OrderStats> getOrderStats(@Param("startDate") LocalDateTime startDate);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Order o SET o.status = :status WHERE o.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") OrderStatus status);
}
```

## Common Pitfalls

1. ❌ Not using constructor injection
   ✅ Use constructor injection for required dependencies

2. ❌ Not handling exceptions properly
   ✅ Implement global exception handling

3. ❌ Not using proper validation
   ✅ Use Bean Validation and custom validators

4. ❌ Not implementing proper testing
   ✅ Write unit, integration, and end-to-end tests

5. ❌ Not using proper logging
   ✅ Implement structured logging with proper levels

6. ❌ Not using proper transaction management
   ✅ Use appropriate transaction boundaries and isolation levels

## Best Practices

1. Use constructor injection
2. Implement proper exception handling
3. Use validation
4. Write comprehensive tests
5. Implement proper logging
6. Use appropriate transaction management
7. Follow SOLID principles
8. Use proper package structure
9. Implement security best practices
10. Use proper caching strategies
11. Implement proper monitoring
12. Use appropriate design patterns

## Knowledge Check

- [ ] Implement constructor injection
- [ ] Set up global exception handling
- [ ] Implement validation
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Implement logging
- [ ] Set up transaction management
- [ ] Implement security
- [ ] Set up monitoring
- [ ] Implement caching

## Additional Resources

- [Spring Framework Best Practices](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#spring-core)
- [Spring Boot Best Practices](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features)
- [Testing in Spring Boot](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.testing)
- [Spring Security Best Practices](https://docs.spring.io/spring-security/reference/index.html)

---

⬅️ Previous: [Deployment](./34-deployment.md)

➡️ Next: [Resources](./36-resources.md)