# Spring Boot Annotations Deep Dive 🎯

## Overview

Spring Boot's annotation-based configuration is key to its "convention over configuration" philosophy. This module covers essential annotations, their use cases, and best practices.

## Core Annotations

### Component Annotations
```java
@Component              // Generic component
@Controller            // MVC controller
@RestController        // REST API controller
@Service              // Business logic
@Repository           // Data access
@Configuration        // Configuration class
```

### Dependency Injection
```java
@Autowired            // Inject dependencies
@Qualifier            // Specify which bean to inject
@Primary              // Preferred bean for injection
@DependsOn           // Declare dependencies
@Lazy                // Lazy initialization
@Scope               // Bean scope (singleton, prototype, etc.)
```

### Request Handling
```java
@RequestMapping       // Map requests to handlers
@GetMapping          // HTTP GET
@PostMapping         // HTTP POST
@PutMapping          // HTTP PUT
@DeleteMapping       // HTTP DELETE
@PatchMapping        // HTTP PATCH
@RequestParam        // URL parameters
@PathVariable        // URL path variables
@RequestBody         // Request body
@ResponseBody        // Response body
```

### Configuration & Properties
```java
@SpringBootApplication    // Main application class
@EnableAutoConfiguration  // Enable auto-configuration
@ComponentScan           // Scan for components
@PropertySource         // External properties
@Value                  // Inject property values
@ConfigurationProperties // Bind properties to class
```

## Real-World Examples

### 1. REST Controller with Dependencies

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final AuditService auditService;

    @Autowired // Constructor injection (can be omitted in newer Spring versions)
    public UserController(
        UserService userService,
        @Qualifier("defaultAuditService") AuditService auditService
    ) {
        this.userService = userService;
        this.auditService = auditService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public User createUser(@Valid @RequestBody UserDTO userDTO) {
        return userService.createUser(userDTO);
    }
}
```

### 2. Configuration with Properties

```java
@Configuration
@PropertySource("classpath:custom.properties")
@EnableCaching
public class AppConfig {
    @Value("${app.cache.size:100}")
    private int cacheSize;

    @Value("${app.timeout:30}")
    private int timeout;

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager();
    }

    @Bean
    @Profile("production")
    public MetricsService metricsService() {
        return new ProductionMetricsService(timeout);
    }
}
```

### 3. Custom Configuration Properties

```java
@Configuration
@ConfigurationProperties(prefix = "app.mail")
@Validated
public class MailProperties {
    @NotEmpty
    private String host;

    @Min(1025) @Max(65536)
    private int port = 587;

    private String username;
    private String password;
    private boolean ssl = true;

    // Getters and setters
}

@Service
public class EmailService {
    private final MailProperties mailProperties;

    public EmailService(MailProperties mailProperties) {
        this.mailProperties = mailProperties;
    }
}
```

## Mini-Project: Custom Annotation

Create a custom annotation for method execution timing:

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogExecutionTime {
    String value() default "";
}

@Aspect
@Component
public class LogExecutionTimeAspect {
    private static final Logger log = LoggerFactory.getLogger(LogExecutionTimeAspect.class);

    @Around("@annotation(logExecutionTime)")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint, LogExecutionTime logExecutionTime) throws Throwable {
        long start = System.currentTimeMillis();
        Object proceed = joinPoint.proceed();
        long executionTime = System.currentTimeMillis() - start;

        String methodName = joinPoint.getSignature().getName();
        String message = logExecutionTime.value().isEmpty()
            ? methodName
            : logExecutionTime.value();

        log.info("{} executed in {} ms", message, executionTime);
        return proceed;
    }
}

// Usage
@Service
public class UserService {
    @LogExecutionTime("Fetch user by ID")
    public User getUser(Long id) {
        // Method implementation
    }
}
```

## Common Pitfalls

1. ❌ Field injection
   ✅ Use constructor injection

2. ❌ Multiple @SpringBootApplication classes
   ✅ Single entry point with proper component scanning

3. ❌ Circular dependencies
   ✅ Proper service design or @Lazy when necessary

4. ❌ Misusing @Autowired
   ✅ Constructor injection and final fields

## Best Practices

1. Favor constructor injection over field injection
2. Use @Slf4j for logging (with Lombok)
3. Keep component responsibilities focused
4. Use meaningful annotation parameters
5. Document custom annotations
6. Use @ConfigurationProperties over @Value
7. Validate configuration properties

## Knowledge Check

- [ ] Explain component stereotypes
- [ ] Compare @Controller vs @RestController
- [ ] Describe dependency injection methods
- [ ] List request mapping annotations
- [ ] Explain @SpringBootApplication
- [ ] Create custom annotations

## Additional Resources

- [Spring Framework Documentation](https://docs.spring.io/spring-framework/reference/core/beans/annotation-config.html)
- [Spring Boot Annotations Guide](https://www.baeldung.com/spring-boot-annotations)
- [Spring @Enable Annotations](https://www.baeldung.com/spring-enable-annotations)
- [Custom Annotations in Spring](https://www.baeldung.com/spring-custom-annotation)

---

⬅️ Previous: [Spring Boot Setup](./03-spring-boot-setup.md)

➡️ Next: [Building REST APIs](./05-rest-apis.md)