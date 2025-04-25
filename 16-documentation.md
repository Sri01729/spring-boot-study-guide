# Documentation in Spring Boot 📝

## Overview

Master documentation practices in Spring Boot applications. Learn about API documentation with OpenAPI/Swagger, code documentation with Javadoc, and project documentation.

## Core Concepts

### 1. OpenAPI/Swagger Configuration

```java
@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI springShopOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Spring Boot API")
                .description("Spring Boot REST API Documentation")
                .version("v1.0.0")
                .license(new License()
                    .name("Apache 2.0")
                    .url("http://springdoc.org")))
            .externalDocs(new ExternalDocumentation()
                .description("Project Wiki")
                .url("https://wiki.example.com"))
            .components(new Components()
                .addSecuritySchemes("bearer-key",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }
}

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User Management", description = "APIs for managing users")
public class UserController {
    @Operation(
        summary = "Create a new user",
        description = "Creates a new user with the provided details",
        tags = { "User Management" }
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "201",
            description = "User created successfully",
            content = @Content(schema = @Schema(implementation = UserDTO.class))
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid input",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "409",
            description = "User already exists",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    @PostMapping
    public ResponseEntity<UserDTO> createUser(
        @RequestBody @Valid UserDTO userDTO
    ) {
        // Implementation
    }

    @Operation(
        summary = "Get user by ID",
        description = "Retrieves a user by their unique identifier"
    )
    @Parameter(
        name = "id",
        description = "User's unique identifier",
        required = true,
        example = "123"
    )
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUser(@PathVariable Long id) {
        // Implementation
    }
}
```

### 2. Model Documentation

```java
@Schema(description = "User Data Transfer Object")
public class UserDTO {
    @Schema(
        description = "User's unique identifier",
        example = "123",
        accessMode = Schema.AccessMode.READ_ONLY
    )
    private Long id;

    @Schema(
        description = "User's email address",
        example = "john.doe@example.com",
        required = true
    )
    @Email
    private String email;

    @Schema(
        description = "User's full name",
        example = "John Doe",
        minLength = 2,
        maxLength = 100
    )
    @Size(min = 2, max = 100)
    private String fullName;

    @Schema(
        description = "User's role in the system",
        example = "ADMIN",
        allowableValues = {"USER", "ADMIN", "MANAGER"}
    )
    private String role;
}
```

### 3. Code Documentation

```java
/**
 * Service class for managing user-related operations.
 * This class handles business logic for user creation, retrieval,
 * update, and deletion.
 *
 * @author John Doe
 * @version 1.0.0
 * @since 2024-03-20
 */
@Service
@Slf4j
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Creates a new user in the system.
     *
     * @param userDTO the user data transfer object containing user details
     * @return the created user DTO
     * @throws UserAlreadyExistsException if a user with the same email exists
     * @throws ValidationException if the user data is invalid
     */
    @Transactional
    public UserDTO createUser(UserDTO userDTO) {
        validateUserData(userDTO);
        checkUserExists(userDTO.getEmail());

        User user = userMapper.toEntity(userDTO);
        user.setPassword(passwordEncoder.encode(userDTO.getPassword()));
        user = userRepository.save(user);

        log.info("Created new user with ID: {}", user.getId());
        return userMapper.toDTO(user);
    }

    /**
     * Validates user data before creation or update.
     *
     * @param userDTO the user data to validate
     * @throws ValidationException if validation fails
     */
    private void validateUserData(UserDTO userDTO) {
        // Implementation
    }
}
```

## Real-World Examples

### 1. Advanced API Documentation

```java
@RestController
@RequestMapping("/api/v1/orders")
@Tag(name = "Order Management", description = "APIs for managing orders")
public class OrderController {
    @Operation(
        summary = "Create a new order",
        description = """
            Creates a new order with the provided items.
            The order will be processed asynchronously and a confirmation
            email will be sent to the customer.

            Rate limit: 100 requests per minute per user.
            """
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "202",
            description = "Order accepted for processing",
            content = @Content(schema = @Schema(implementation = OrderResponse.class))
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid input",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "429",
            description = "Too many requests",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    })
    @SecurityRequirement(name = "bearer-key")
    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(
        @RequestBody @Valid OrderRequest orderRequest,
        @Parameter(hidden = true)
        @RequestHeader("X-Correlation-ID") String correlationId
    ) {
        // Implementation
    }

    @Operation(
        summary = "Get order history",
        description = "Retrieves paginated order history for the authenticated user"
    )
    @Parameters({
        @Parameter(
            name = "page",
            description = "Page number (0-based)",
            schema = @Schema(type = "integer", defaultValue = "0")
        ),
        @Parameter(
            name = "size",
            description = "Page size",
            schema = @Schema(type = "integer", defaultValue = "20")
        ),
        @Parameter(
            name = "sort",
            description = "Sort field and direction (e.g., createdAt,desc)",
            schema = @Schema(type = "string", example = "createdAt,desc")
        )
    })
    @GetMapping
    public ResponseEntity<Page<OrderDTO>> getOrderHistory(
        @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC)
        Pageable pageable
    ) {
        // Implementation
    }
}
```

### 2. Project Documentation

```markdown
# Project Name

## Overview

Brief description of the project, its purpose, and key features.

## Getting Started

### Prerequisites

- Java 17 or higher
- Maven 3.8.x
- PostgreSQL 14.x
- Redis 6.x

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/organization/project.git
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build the project:
   ```bash
   mvn clean install
   ```

4. Run the application:
   ```bash
   mvn spring-boot:run
   ```

## Architecture

### System Components

```ascii
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  API Gateway │────▶│ Auth Service │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                     ┌─────┴─────┐
                     ▼           ▼
              ┌──────────┐ ┌──────────┐
              │  Order   │ │  User    │
              │ Service  │ │ Service  │
              └──────────┘ └──────────┘
```

### Database Schema

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## API Documentation

API documentation is available at:
- Development: http://localhost:8080/swagger-ui.html
- Staging: https://api-staging.example.com/swagger-ui.html
- Production: https://api.example.com/swagger-ui.html

## Development

### Code Style

We follow the Google Java Style Guide. Configuration files for popular IDEs are in the `.idea` directory.

### Testing

```bash
# Run unit tests
mvn test

# Run integration tests
mvn verify -P integration-test

# Generate test coverage report
mvn jacoco:report
```

### Branching Strategy

We use GitFlow with the following branches:
- `main`: Production releases
- `develop`: Development branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `release/*`: Release candidates
- `hotfix/*`: Production hotfixes

## Deployment

### Environment Setup

Each environment requires the following configuration:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  redis:
    host: ${REDIS_HOST}
    port: ${REDIS_PORT}
    password: ${REDIS_PASSWORD}

security:
  jwt:
    secret: ${JWT_SECRET}
    expiration: ${JWT_EXPIRATION}

aws:
  access-key: ${AWS_ACCESS_KEY}
  secret-key: ${AWS_SECRET_KEY}
  region: ${AWS_REGION}
  s3:
    bucket: ${S3_BUCKET}
```

### Deployment Process

1. Build Docker image:
   ```bash
   docker build -t myapp:latest .
   ```

2. Push to registry:
   ```bash
   docker push myregistry.azurecr.io/myapp:latest
   ```

3. Deploy to Kubernetes:
   ```bash
   kubectl apply -f k8s/
   ```

## Monitoring

### Health Checks

Health endpoints are available at:
- `/actuator/health`: Application health
- `/actuator/metrics`: Application metrics
- `/actuator/prometheus`: Prometheus metrics

### Logging

Logs are structured in JSON format and include:
- Correlation ID
- Request ID
- User ID (if authenticated)
- Service name
- Environment
- Log level
- Timestamp
- Message
- Stack trace (for errors)

### Metrics

Key metrics to monitor:
- Request rate
- Error rate
- Response time (p95, p99)
- CPU usage
- Memory usage
- Database connection pool
- Cache hit ratio

## Support

For support:
1. Check the [FAQ](docs/FAQ.md)
2. Search [existing issues](https://github.com/organization/project/issues)
3. Contact the team at support@example.com
```

### 3. Technical Documentation

```java
/**
 * Package containing core business logic for order processing.
 *
 * <h2>Key Components</h2>
 * <ul>
 *   <li>{@link OrderService}: Main service for order operations</li>
 *   <li>{@link OrderValidator}: Validates order requests</li>
 *   <li>{@link OrderProcessor}: Processes validated orders</li>
 * </ul>
 *
 * <h2>Flow Diagram</h2>
 * <pre>
 * [OrderController] → [OrderService] → [OrderValidator]
 *                                   → [OrderProcessor]
 *                                   → [NotificationService]
 * </pre>
 *
 * @see OrderService
 * @see OrderValidator
 * @see OrderProcessor
 */
package com.example.orders;

/**
 * Configuration for order processing components.
 *
 * <h2>Configuration Properties</h2>
 * <pre>
 * order:
 *   processing:
 *     timeout: 30s
 *     retry:
 *       max-attempts: 3
 *       backoff:
 *         initial: 1s
 *         multiplier: 2
 *     async:
 *       core-pool-size: 5
 *       max-pool-size: 10
 *       queue-capacity: 25
 * </pre>
 */
@Configuration
@ConfigurationProperties(prefix = "order.processing")
public class OrderConfig {
    // Implementation
}
```

## Common Pitfalls

1. ❌ Missing API documentation
   ✅ Document all endpoints with OpenAPI

2. ❌ Outdated documentation
   ✅ Keep docs in sync with code

3. ❌ Poor code comments
   ✅ Write meaningful Javadoc

4. ❌ Incomplete README
   ✅ Include all necessary setup steps

## Best Practices

1. Use OpenAPI/Swagger for API docs
2. Write clear Javadoc comments
3. Keep README up to date
4. Document configuration properties
5. Include setup instructions
6. Document error responses
7. Use meaningful examples
8. Version your documentation

## Knowledge Check

- [ ] Configure OpenAPI/Swagger
- [ ] Write Javadoc comments
- [ ] Create project README
- [ ] Document API endpoints
- [ ] Document configuration
- [ ] Generate API documentation

## Additional Resources

- [SpringDoc OpenAPI](https://springdoc.org/)
- [Javadoc Guide](https://www.oracle.com/technical-resources/articles/java/javadoc-tool.html)
- [Spring Boot Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Technical Writing Guide](https://developers.google.com/tech-writing)

---

⬅️ Previous: [Validation](./15-validation.md)

➡️ Next: [Testing](./17-testing.md)