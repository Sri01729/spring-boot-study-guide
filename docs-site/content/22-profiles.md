# Spring Boot Profiles 🔄

## Overview

Master Spring Boot Profiles for managing different application configurations across environments. Learn about profile-specific properties, configuration, and best practices for environment management.

## Core Concepts

### 1. Profile Configuration

```properties
# application.properties
spring.profiles.active=dev
spring.profiles.group.production=prod,metrics,actuator
spring.profiles.group.development=dev,swagger

# application-dev.properties
server.port=8080
spring.datasource.url=jdbc:postgresql://localhost:5432/devdb
logging.level.root=DEBUG

# application-prod.properties
server.port=80
spring.datasource.url=jdbc:postgresql://prod-db:5432/proddb
logging.level.root=INFO
```

```yaml
# application.yml
spring:
  profiles:
    active: dev
    group:
      production:
        - prod
        - metrics
        - actuator
      development:
        - dev
        - swagger

---
spring:
  config:
    activate:
      on-profile: dev
server:
  port: 8080
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/devdb
logging:
  level:
    root: DEBUG

---
spring:
  config:
    activate:
      on-profile: prod
server:
  port: 80
spring:
  datasource:
    url: jdbc:postgresql://prod-db:5432/proddb
logging:
  level:
    root: INFO
```

### 2. Profile-Based Configuration

```java
@Configuration
public class DatabaseConfig {
    @Bean
    @Profile("dev")
    public DataSource devDataSource() {
        return DataSourceBuilder.create()
            .url("jdbc:h2:mem:devdb")
            .username("sa")
            .password("")
            .build();
    }

    @Bean
    @Profile("prod")
    public DataSource prodDataSource() {
        return DataSourceBuilder.create()
            .url("jdbc:postgresql://prod-db:5432/proddb")
            .username("${db.username}")
            .password("${db.password}")
            .build();
    }
}

@Configuration
@Profile("dev")
public class DevConfig {
    @Bean
    public SwaggerConfig swaggerConfig() {
        return new SwaggerConfig();
    }

    @Bean
    public DevToolsConfig devToolsConfig() {
        return new DevToolsConfig();
    }
}

@Configuration
@Profile("prod")
public class ProdConfig {
    @Bean
    public MetricsConfig metricsConfig() {
        return new MetricsConfig();
    }

    @Bean
    public CacheConfig cacheConfig() {
        return new CacheConfig();
    }
}
```

### 3. Profile Activation

```java
@Component
public class ProfileManager {
    private final Environment environment;

    public boolean isDevProfile() {
        return Arrays.asList(environment.getActiveProfiles())
            .contains("dev");
    }

    public boolean isProdProfile() {
        return Arrays.asList(environment.getActiveProfiles())
            .contains("prod");
    }

    @PostConstruct
    public void logActiveProfiles() {
        log.info("Active profiles: {}",
            String.join(", ", environment.getActiveProfiles()));
    }
}
```

## Real-World Examples

### 1. Environment-Specific Services

```java
@Service
@Profile("dev")
public class DevEmailService implements EmailService {
    @Override
    public void sendEmail(String to, String subject, String body) {
        log.info("DEV - Sending email to: {}", to);
        // Email is logged but not actually sent
    }
}

@Service
@Profile("prod")
public class ProdEmailService implements EmailService {
    private final AWSSimpleEmailService sesClient;

    @Override
    public void sendEmail(String to, String subject, String body) {
        SendEmailRequest request = new SendEmailRequest()
            .withDestination(new Destination().withToAddresses(to))
            .withMessage(new Message()
                .withSubject(new Content().withData(subject))
                .withBody(new Body().withText(new Content().withData(body))))
            .withSource("noreply@example.com");

        sesClient.sendEmail(request);
    }
}
```

### 2. Profile-Based Security Configuration

```java
@Configuration
@Profile("dev")
public class DevSecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            .csrf().disable()
            .authorizeRequests()
            .antMatchers("/h2-console/**").permitAll()
            .antMatchers("/swagger-ui/**").permitAll()
            .antMatchers("/actuator/**").permitAll()
            .anyRequest().authenticated()
            .and()
            .headers().frameOptions().disable();
    }
}

@Configuration
@Profile("prod")
public class ProdSecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            .csrf().csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            .and()
            .authorizeRequests()
            .antMatchers("/actuator/health").permitAll()
            .antMatchers("/actuator/**").hasRole("ADMIN")
            .anyRequest().authenticated()
            .and()
            .sessionManagement()
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS);
    }
}
```

### 3. Profile-Specific Cache Configuration

```java
@Configuration
public class CacheConfig {
    @Bean
    @Profile("dev")
    public CacheManager devCacheManager() {
        SimpleCacheManager cacheManager = new SimpleCacheManager();
        cacheManager.setCaches(Arrays.asList(
            new ConcurrentMapCache("users"),
            new ConcurrentMapCache("products")
        ));
        return cacheManager;
    }

    @Bean
    @Profile("prod")
    public CacheManager prodCacheManager(RedisConnectionFactory redisConnectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(60))
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(redisConnectionFactory)
            .cacheDefaults(config)
            .withCacheConfiguration("users",
                RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofMinutes(10)))
            .withCacheConfiguration("products",
                RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofHours(1)))
            .build();
    }
}
```

## Common Pitfalls

1. ❌ Hardcoding sensitive information in properties
   ✅ Use environment variables or secure vaults

2. ❌ Mixing profile-specific code
   ✅ Use proper separation of concerns

3. ❌ Inconsistent profile naming
   ✅ Follow consistent naming conventions

4. ❌ Missing profile validation
   ✅ Validate required properties on startup

## Best Practices

1. Use meaningful profile names
2. Keep profiles focused
3. Use profile groups
4. Externalize sensitive data
5. Validate configurations
6. Document profile requirements
7. Use default profiles wisely
8. Test all profile combinations

## Knowledge Check

- [ ] Configure basic profiles
- [ ] Create profile-specific properties
- [ ] Implement profile-based beans
- [ ] Set up profile groups
- [ ] Handle environment-specific configurations
- [ ] Validate profile configurations

## Additional Resources

- [Spring Boot Profiles Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.profiles)
- [Spring Framework Environment Abstraction](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#beans-environment)
- [Configuration Properties Guide](https://docs.spring.io/spring-boot/docs/current/reference/html/configuration-metadata.html)
- [Externalized Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config)

---

⬅️ Previous: [Logging](./21-logging.md)

➡️ Next: [Properties](./23-properties.md)