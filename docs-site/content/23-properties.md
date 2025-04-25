# Spring Boot Properties 🔧

## Overview

Master Spring Boot Properties for managing application configuration. Learn about property sources, configuration classes, relaxed binding, and type-safe configuration properties.

## Core Concepts

### 1. Property Sources

```properties
# application.properties
app.name=MyApp
app.description=${app.name} is a Spring Boot application
app.version=1.0.0

# Custom configuration
app.api.endpoint=https://api.example.com
app.api.timeout=5000
app.api.retry-attempts=3

# Database configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/mydb
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}

# Cache configuration
app.cache.ttl=3600
app.cache.max-size=1000
```

```yaml
# application.yml
app:
  name: MyApp
  description: ${app.name} is a Spring Boot application
  version: 1.0.0

  api:
    endpoint: https://api.example.com
    timeout: 5000
    retry-attempts: 3

  cache:
    ttl: 3600
    max-size: 1000

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

### 2. Configuration Properties

```java
@Configuration
@ConfigurationProperties(prefix = "app")
@Validated
public class AppProperties {
    @NotEmpty
    private String name;
    private String description;
    private String version;
    private ApiConfig api;
    private CacheConfig cache;

    @Validated
    public static class ApiConfig {
        @NotEmpty
        private String endpoint;
        @Min(1000)
        private int timeout;
        @Min(1)
        private int retryAttempts;

        // Getters and setters
    }

    @Validated
    public static class CacheConfig {
        @Min(0)
        private int ttl;
        @Min(100)
        private int maxSize;

        // Getters and setters
    }

    // Getters and setters
}
```

### 3. Property Binding

```java
@Component
@ConfigurationProperties(prefix = "mail")
public class MailProperties {
    private String host;
    private int port = 25;
    private Credentials credentials = new Credentials();
    private List<String> recipients = new ArrayList<>();
    private Map<String, String> headers = new HashMap<>();

    public static class Credentials {
        private String username;
        private String password;
        private Duration timeout = Duration.ofSeconds(30);

        // Getters and setters
    }

    // Getters and setters
}
```

## Real-World Examples

### 1. Dynamic Property Updates

```java
@Service
@RefreshScope
public class DynamicConfigService {
    @Value("${app.feature.enabled:false}")
    private boolean featureEnabled;

    @Value("${app.rate.limit:100}")
    private int rateLimit;

    public boolean isFeatureEnabled() {
        return featureEnabled;
    }

    public int getRateLimit() {
        return rateLimit;
    }
}

@Configuration
public class RefreshConfig {
    @Bean
    public RefreshEndpoint refreshEndpoint() {
        return new RefreshEndpoint();
    }

    @Bean
    public RefreshScopeRefreshedEvent refreshScopeRefreshedEvent() {
        return new RefreshScopeRefreshedEvent();
    }
}
```

### 2. Custom Property Source

```java
@Configuration
public class CustomPropertySourceConfig {
    @Bean
    public PropertySourcesPlaceholderConfigurer propertySourcesPlaceholderConfigurer() {
        PropertySourcesPlaceholderConfigurer configurer =
            new PropertySourcesPlaceholderConfigurer();

        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("config/custom-config.yml"));

        configurer.setProperties(yaml.getObject());
        return configurer;
    }

    @Bean
    public static PropertySource<?> customPropertySource() {
        return new PropertySource<Object>("customProperties") {
            private final Map<String, Object> properties = loadProperties();

            @Override
            public Object getProperty(String name) {
                return properties.get(name);
            }

            private Map<String, Object> loadProperties() {
                // Load properties from external source
                return new HashMap<>();
            }
        };
    }
}
```

### 3. Property Validation and Conversion

```java
@Configuration
@ConfigurationProperties(prefix = "app.validation")
@Validated
public class ValidationProperties {
    @Pattern(regexp = "^[A-Z][a-z]*$")
    private String name;

    @URL
    private String websiteUrl;

    @Email
    private String supportEmail;

    @Min(0)
    @Max(100)
    private int threshold;

    @NotEmpty
    private List<@Valid @NotNull UserConfig> users;

    public static class UserConfig {
        @NotEmpty
        private String username;

        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$")
        private String password;

        @NotEmpty
        private Set<@Pattern(regexp = "^ROLE_[A-Z]+$") String> roles;

        // Getters and setters
    }

    // Getters and setters
}

@ControllerAdvice
public class PropertyValidationExceptionHandler {
    @ExceptionHandler(BindException.class)
    public ResponseEntity<Map<String, String>> handleBindException(BindException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
            errors.put(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(errors);
    }
}
```

## Common Pitfalls

1. ❌ Hardcoding sensitive properties
   ✅ Use environment variables or secure vaults

2. ❌ Missing property validation
   ✅ Use @Validated and constraints

3. ❌ Ignoring property binding failures
   ✅ Handle binding exceptions properly

4. ❌ Not using type-safe configuration
   ✅ Use @ConfigurationProperties

## Best Practices

1. Use type-safe configuration
2. Validate properties
3. Document configuration
4. Use meaningful prefixes
5. Provide defaults
6. Externalize sensitive data
7. Use property hierarchies
8. Test configurations

## Knowledge Check

- [ ] Configure basic properties
- [ ] Create type-safe configuration
- [ ] Implement property validation
- [ ] Set up custom property sources
- [ ] Handle property binding
- [ ] Test property configurations

## Additional Resources

- [Spring Boot Properties Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/application-properties.html)
- [Configuration Properties Guide](https://docs.spring.io/spring-boot/docs/current/reference/html/configuration-metadata.html)
- [Relaxed Binding](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config.typesafe-configuration-properties.relaxed-binding)
- [Property Validation](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config.typesafe-configuration-properties.validation)

---

⬅️ Previous: [Profiles](./22-profiles.md)

➡️ Next: [Async](./24-async.md)