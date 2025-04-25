# Testing in Spring Boot 🧪

## Overview

Master testing strategies in Spring Boot applications. Learn unit testing, integration testing, mocking, test containers, and testing best practices.

## Core Concepts

### 1. Unit Testing Configuration

```java
@ExtendWith(MockitoExtension.class)
public class UserServiceTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void createUser_WithValidData_ShouldSucceed() {
        // Arrange
        UserRegistrationRequest request = new UserRegistrationRequest(
            "test@example.com",
            "password123"
        );

        User user = new User();
        user.setId(1L);
        user.setEmail(request.getEmail());
        user.setPassword("encodedPassword");

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(passwordEncoder.encode(request.getPassword())).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Act
        UserDTO result = userService.createUser(request);

        // Assert
        assertNotNull(result);
        assertEquals(request.getEmail(), result.getEmail());
        verify(userRepository).existsByEmail(request.getEmail());
        verify(passwordEncoder).encode(request.getPassword());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void createUser_WithExistingEmail_ShouldThrowException() {
        // Arrange
        UserRegistrationRequest request = new UserRegistrationRequest(
            "existing@example.com",
            "password123"
        );

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);

        // Act & Assert
        assertThrows(UserAlreadyExistsException.class, () -> {
            userService.createUser(request);
        });

        verify(userRepository).existsByEmail(request.getEmail());
        verifyNoMoreInteractions(userRepository);
        verifyNoInteractions(passwordEncoder);
    }
}
```

### 2. Integration Testing

```java
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@ActiveProfiles("test")
public class UserControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestEntityManager entityManager;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void registerUser_WithValidData_ShouldSucceed() throws Exception {
        // Arrange
        UserRegistrationRequest request = new UserRegistrationRequest(
            "test@example.com",
            "password123"
        );

        // Act & Assert
        mockMvc.perform(post("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value(request.getEmail()))
            .andExpect(jsonPath("$.id").exists())
            .andDo(print());

        assertTrue(userRepository.existsByEmail(request.getEmail()));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getAllUsers_AsAdmin_ShouldReturnUsers() throws Exception {
        // Arrange
        createTestUser("user1@example.com");
        createTestUser("user2@example.com");

        // Act & Assert
        mockMvc.perform(get("/api/users")
            .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].email").exists())
            .andExpect(jsonPath("$[1].email").exists())
            .andDo(print());
    }

    private User createTestUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("encodedPassword");
        return entityManager.persist(user);
    }
}
```

### 3. Test Containers

```java
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
public class DatabaseIntegrationTest {
    @Container
    private static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        "postgres:13-alpine"
    )
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    void testDatabaseConnection() {
        assertTrue(postgres.isRunning());
        assertNotNull(userRepository);
    }

    @Test
    void testUserPersistence() {
        // Arrange
        User user = new User();
        user.setEmail("test@example.com");
        user.setPassword("password");

        // Act
        User savedUser = userRepository.save(user);

        // Assert
        assertNotNull(savedUser.getId());
        Optional<User> foundUser = userRepository.findById(savedUser.getId());
        assertTrue(foundUser.isPresent());
        assertEquals(user.getEmail(), foundUser.get().getEmail());
    }
}
```

## Real-World Examples

### 1. Service Layer Testing

```java
@ExtendWith(MockitoExtension.class)
public class OrderServiceTest {
    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentService paymentService;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private OrderService orderService;

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    @Test
    void createOrder_WithValidData_ShouldSucceed() {
        // Arrange
        OrderRequest request = new OrderRequest(
            Arrays.asList(
                new OrderItemRequest("item1", 2),
                new OrderItemRequest("item2", 1)
            ),
            "USD"
        );

        when(orderRepository.save(any(Order.class)))
            .thenAnswer(invocation -> {
                Order order = invocation.getArgument(0);
                order.setId(1L);
                return order;
            });

        when(paymentService.processPayment(any(PaymentRequest.class)))
            .thenReturn(new PaymentResponse("COMPLETED", "TXN123"));

        // Act
        OrderDTO result = orderService.createOrder(request);

        // Assert
        assertNotNull(result);
        assertEquals(OrderStatus.CONFIRMED, result.getStatus());
        verify(orderRepository).save(orderCaptor.capture());
        verify(paymentService).processPayment(any(PaymentRequest.class));
        verify(notificationService).sendOrderConfirmation(any(Order.class));

        Order capturedOrder = orderCaptor.getValue();
        assertEquals(2, capturedOrder.getItems().size());
        assertEquals(request.getCurrency(), capturedOrder.getCurrency());
    }

    @Test
    void createOrder_WhenPaymentFails_ShouldThrowException() {
        // Arrange
        OrderRequest request = new OrderRequest(
            Collections.singletonList(new OrderItemRequest("item1", 1)),
            "USD"
        );

        when(paymentService.processPayment(any(PaymentRequest.class)))
            .thenThrow(new PaymentProcessingException("Payment failed"));

        // Act & Assert
        assertThrows(OrderProcessingException.class, () -> {
            orderService.createOrder(request);
        });

        verify(orderRepository).save(any(Order.class));
        verify(paymentService).processPayment(any(PaymentRequest.class));
        verify(notificationService, never()).sendOrderConfirmation(any(Order.class));
    }

    @Test
    void getOrdersByUser_ShouldReturnFilteredOrders() {
        // Arrange
        Long userId = 1L;
        List<Order> orders = Arrays.asList(
            createTestOrder(1L, userId),
            createTestOrder(2L, userId)
        );

        when(orderRepository.findByUserId(userId)).thenReturn(orders);

        // Act
        List<OrderDTO> result = orderService.getOrdersByUser(userId);

        // Assert
        assertNotNull(result);
        assertEquals(2, result.size());
        verify(orderRepository).findByUserId(userId);
    }

    private Order createTestOrder(Long orderId, Long userId) {
        Order order = new Order();
        order.setId(orderId);
        order.setUserId(userId);
        order.setStatus(OrderStatus.CONFIRMED);
        return order;
    }
}
```

### 2. Controller Layer Testing

```java
@WebMvcTest(OrderController.class)
public class OrderControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser
    void createOrder_WithValidRequest_ShouldReturnCreated() throws Exception {
        // Arrange
        OrderRequest request = new OrderRequest(
            Arrays.asList(
                new OrderItemRequest("item1", 2),
                new OrderItemRequest("item2", 1)
            ),
            "USD"
        );

        OrderDTO response = new OrderDTO(
            1L,
            OrderStatus.CONFIRMED,
            request.getItems(),
            request.getCurrency(),
            LocalDateTime.now()
        );

        when(orderService.createOrder(any(OrderRequest.class)))
            .thenReturn(response);

        // Act & Assert
        mockMvc.perform(post("/api/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(response.getId()))
            .andExpect(jsonPath("$.status").value(response.getStatus().toString()))
            .andExpect(jsonPath("$.items", hasSize(2)))
            .andDo(print());

        verify(orderService).createOrder(any(OrderRequest.class));
    }

    @Test
    @WithMockUser
    void getOrder_WithExistingId_ShouldReturnOrder() throws Exception {
        // Arrange
        Long orderId = 1L;
        OrderDTO order = new OrderDTO(
            orderId,
            OrderStatus.CONFIRMED,
            Collections.emptyList(),
            "USD",
            LocalDateTime.now()
        );

        when(orderService.getOrder(orderId)).thenReturn(order);

        // Act & Assert
        mockMvc.perform(get("/api/orders/{id}", orderId)
            .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(orderId))
            .andExpect(jsonPath("$.status").value(order.getStatus().toString()))
            .andDo(print());

        verify(orderService).getOrder(orderId);
    }

    @Test
    @WithMockUser
    void getOrder_WithNonExistingId_ShouldReturnNotFound() throws Exception {
        // Arrange
        Long orderId = 999L;

        when(orderService.getOrder(orderId))
            .thenThrow(new ResourceNotFoundException("Order not found"));

        // Act & Assert
        mockMvc.perform(get("/api/orders/{id}", orderId)
            .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andDo(print());

        verify(orderService).getOrder(orderId);
    }
}
```

### 3. Repository Layer Testing

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
public class OrderRepositoryTest {
    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void findByUserId_ShouldReturnUserOrders() {
        // Arrange
        Long userId = 1L;
        Order order1 = createTestOrder(userId);
        Order order2 = createTestOrder(userId);
        Order otherUserOrder = createTestOrder(2L);

        entityManager.persist(order1);
        entityManager.persist(order2);
        entityManager.persist(otherUserOrder);
        entityManager.flush();

        // Act
        List<Order> foundOrders = orderRepository.findByUserId(userId);

        // Assert
        assertEquals(2, foundOrders.size());
        assertTrue(foundOrders.stream()
            .allMatch(order -> order.getUserId().equals(userId)));
    }

    @Test
    void findByStatus_ShouldReturnOrdersWithStatus() {
        // Arrange
        Order confirmedOrder1 = createTestOrder(1L, OrderStatus.CONFIRMED);
        Order confirmedOrder2 = createTestOrder(2L, OrderStatus.CONFIRMED);
        Order pendingOrder = createTestOrder(3L, OrderStatus.PENDING);

        entityManager.persist(confirmedOrder1);
        entityManager.persist(confirmedOrder2);
        entityManager.persist(pendingOrder);
        entityManager.flush();

        // Act
        List<Order> confirmedOrders = orderRepository.findByStatus(OrderStatus.CONFIRMED);

        // Assert
        assertEquals(2, confirmedOrders.size());
        assertTrue(confirmedOrders.stream()
            .allMatch(order -> order.getStatus() == OrderStatus.CONFIRMED));
    }

    @Test
    void save_WithValidOrder_ShouldPersistOrder() {
        // Arrange
        Order order = createTestOrder(1L);

        // Act
        Order savedOrder = orderRepository.save(order);

        // Assert
        assertNotNull(savedOrder.getId());
        Order foundOrder = entityManager.find(Order.class, savedOrder.getId());
        assertNotNull(foundOrder);
        assertEquals(order.getUserId(), foundOrder.getUserId());
        assertEquals(order.getStatus(), foundOrder.getStatus());
    }

    private Order createTestOrder(Long userId) {
        return createTestOrder(userId, OrderStatus.CONFIRMED);
    }

    private Order createTestOrder(Long userId, OrderStatus status) {
        Order order = new Order();
        order.setUserId(userId);
        order.setStatus(status);
        order.setCurrency("USD");
        order.setItems(Collections.emptyList());
        return order;
    }
}
```

## Common Pitfalls

1. ❌ Insufficient test coverage
   ✅ Aim for comprehensive test coverage

2. ❌ Brittle tests
   ✅ Write robust and maintainable tests

3. ❌ Missing integration tests
   ✅ Include both unit and integration tests

4. ❌ Poor test data management
   ✅ Use proper test data setup and cleanup

## Best Practices

1. Follow AAA pattern (Arrange, Act, Assert)
2. Use meaningful test names
3. Test edge cases and error scenarios
4. Keep tests independent
5. Use appropriate test doubles
6. Clean up test data
7. Use test containers for integration tests
8. Maintain test code quality

## Knowledge Check

- [ ] Write unit tests
- [ ] Implement integration tests
- [ ] Use test containers
- [ ] Mock dependencies
- [ ] Test error scenarios
- [ ] Measure test coverage

## Additional Resources

- [Spring Boot Testing Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.testing)
- [JUnit 5 User Guide](https://junit.org/junit5/docs/current/user-guide/)
- [Mockito Documentation](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html)
- [Testcontainers Documentation](https://www.testcontainers.org/)

---

⬅️ Previous: [Documentation](./16-documentation.md)

➡️ Next: [Logging](./18-logging.md)