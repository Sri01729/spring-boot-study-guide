# DTO Mapping in Spring Boot 🔄

## Overview

Master Data Transfer Object (DTO) patterns in Spring Boot applications. Learn about manual mapping, MapStruct, ModelMapper, and best practices for efficient data transformation.

## Core Concepts

### 1. Basic DTO Pattern

```java
// Entity
@Entity
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String username;
    private String email;
    private String password;
    private LocalDateTime createdAt;
    private boolean active;

    // Getters and setters
}

// DTO
public class UserDTO {
    private Long id;
    private String username;
    private String email;

    // Getters and setters
}

// Manual Mapper
@Component
public class UserMapper {
    public UserDTO toDTO(User user) {
        if (user == null) return null;

        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        return dto;
    }

    public User toEntity(UserDTO dto) {
        if (dto == null) return null;

        User user = new User();
        user.setId(dto.getId());
        user.setUsername(dto.getUsername());
        user.setEmail(dto.getEmail());
        return user;
    }

    public List<UserDTO> toDTOList(List<User> users) {
        return users.stream()
                   .map(this::toDTO)
                   .collect(Collectors.toList());
    }
}
```

### 2. MapStruct Implementation

```java
// Add to pom.xml
<dependency>
    <groupId>org.mapstruct</groupId>
    <artifactId>mapstruct</artifactId>
    <version>1.5.5.Final</version>
</dependency>
<dependency>
    <groupId>org.mapstruct</groupId>
    <artifactId>mapstruct-processor</artifactId>
    <version>1.5.5.Final</version>
    <scope>provided</scope>
</dependency>

// Mapper Interface
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserDTO toDTO(User user);
    User toEntity(UserDTO dto);
    List<UserDTO> toDTOList(List<User> users);

    @Mapping(target = "password", ignore = true)
    @Mapping(target = "createdAt", expression = "java(LocalDateTime.now())")
    User toEntityForCreate(UserCreateDTO dto);
}

// Usage in Service
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final UserRepository userRepository;

    public UserDTO createUser(UserCreateDTO dto) {
        User user = userMapper.toEntityForCreate(dto);
        user = userRepository.save(user);
        return userMapper.toDTO(user);
    }
}
```

### 3. ModelMapper Configuration

```java
@Configuration
public class ModelMapperConfig {
    @Bean
    public ModelMapper modelMapper() {
        ModelMapper mapper = new ModelMapper();

        mapper.getConfiguration()
              .setMatchingStrategy(MatchingStrategies.STRICT)
              .setFieldMatchingEnabled(true)
              .setSkipNullEnabled(true)
              .setFieldAccessLevel(Configuration.AccessLevel.PRIVATE);

        // Custom mappings
        mapper.createTypeMap(User.class, UserDTO.class)
              .addMappings(m -> m.skip(UserDTO::setPassword));

        return mapper;
    }
}

@Service
@RequiredArgsConstructor
public class UserService {
    private final ModelMapper modelMapper;

    public UserDTO toDTO(User user) {
        return modelMapper.map(user, UserDTO.class);
    }

    public User toEntity(UserDTO dto) {
        return modelMapper.map(dto, User.class);
    }
}
```

## Real-World Examples

### 1. Complex Object Mapping

```java
// Entities
@Entity
public class Order {
    @Id
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private List<OrderItem> items;

    private BigDecimal totalAmount;
    private OrderStatus status;
    private LocalDateTime createdAt;
}

@Entity
public class OrderItem {
    @Id
    private Long id;

    @ManyToOne
    private Order order;

    @ManyToOne
    private Product product;

    private Integer quantity;
    private BigDecimal price;
}

// DTOs
public class OrderDTO {
    private Long id;
    private CustomerSummaryDTO customer;
    private List<OrderItemDTO> items;
    private BigDecimal totalAmount;
    private String status;
    private LocalDateTime createdAt;
}

public class OrderItemDTO {
    private Long id;
    private ProductSummaryDTO product;
    private Integer quantity;
    private BigDecimal price;
}

// MapStruct Mapper
@Mapper(componentModel = "spring", uses = {CustomerMapper.class, ProductMapper.class})
public interface OrderMapper {
    @Mapping(target = "status", expression = "java(order.getStatus().name())")
    OrderDTO toDTO(Order order);

    @Mapping(target = "order", ignore = true)
    OrderItemDTO toDTO(OrderItem item);

    @Mapping(target = "status", expression = "java(OrderStatus.valueOf(dto.getStatus()))")
    Order toEntity(OrderDTO dto);

    @Mapping(target = "order", ignore = true)
    OrderItem toEntity(OrderItemDTO dto);
}
```

### 2. Nested DTO Mapping

```java
// Entities
@Entity
public class Department {
    @Id
    private Long id;
    private String name;

    @OneToMany(mappedBy = "department")
    private List<Employee> employees;

    @ManyToOne
    private Company company;
}

// DTOs
public class DepartmentDTO {
    private Long id;
    private String name;
    private List<EmployeeSummaryDTO> employees;
    private CompanySummaryDTO company;
}

public class DepartmentSummaryDTO {
    private Long id;
    private String name;
    private int employeeCount;
}

// MapStruct Mapper with Custom Methods
@Mapper(componentModel = "spring", uses = {EmployeeMapper.class, CompanyMapper.class})
public abstract class DepartmentMapper {
    @Mapping(target = "employeeCount", ignore = true)
    public abstract DepartmentSummaryDTO toSummaryDTO(Department department);

    @AfterMapping
    protected void setEmployeeCount(@MappingTarget DepartmentSummaryDTO dto, Department department) {
        dto.setEmployeeCount(department.getEmployees().size());
    }

    public abstract DepartmentDTO toDTO(Department department);
    public abstract Department toEntity(DepartmentDTO dto);
}
```

### 3. Validation and Error Handling

```java
// DTO with Validation
public class UserCreateDTO {
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Password is required")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$",
             message = "Password must be at least 8 characters long and contain both letters and numbers")
    private String password;
}

// Service with Validation
@Service
@Validated
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final UserRepository userRepository;

    public UserDTO createUser(@Valid UserCreateDTO dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new EmailAlreadyExistsException("Email already registered: " + dto.getEmail());
        }

        User user = userMapper.toEntityForCreate(dto);
        user = userRepository.save(user);
        return userMapper.toDTO(user);
    }
}

// Exception Handler
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult()
                               .getFieldErrors()
                               .stream()
                               .map(FieldError::getDefaultMessage)
                               .collect(Collectors.toList());

        ErrorResponse errorResponse = new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation failed",
            errors
        );

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }
}
```

## Common Pitfalls

1. ❌ Circular dependencies in DTOs
   ✅ Use summary DTOs for nested objects

2. ❌ N+1 queries when mapping collections
   ✅ Use fetch joins and optimize queries

3. ❌ Exposing sensitive data
   ✅ Use specific DTOs for different use cases

4. ❌ Performance issues with deep object graphs
   ✅ Implement lazy loading strategies

## Best Practices

1. Use MapStruct for complex mappings
2. Create specific DTOs for different use cases
3. Implement validation at the DTO level
4. Use summary DTOs for nested objects
5. Handle null values appropriately
6. Document DTO structures
7. Implement proper error handling
8. Use builder pattern for complex DTOs

## Knowledge Check

- [ ] Implement basic DTO mapping
- [ ] Configure MapStruct
- [ ] Handle nested object mapping
- [ ] Implement validation
- [ ] Create summary DTOs
- [ ] Handle collections mapping

## Additional Resources

- [MapStruct Documentation](https://mapstruct.org/documentation/stable/reference/html/)
- [ModelMapper User Manual](http://modelmapper.org/user-manual/)
- [Spring Validation Guide](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#validation)
- [DTO Pattern Best Practices](https://www.baeldung.com/java-dto-pattern)

---

⬅️ Previous: [Entity Relationships](./11-entity-relationships.md)

➡️ Next: [Service Layer](./13-service-layer.md)