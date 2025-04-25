# Spring Cloud Features and Components ☁️

## Overview

Master Spring Cloud components for building cloud-native applications. Learn about service discovery, configuration management, circuit breakers, and other cloud patterns.

## Core Concepts

### 1. Service Discovery with Eureka

```java
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}

application.yml:
```yaml
server:
  port: 8761

eureka:
  client:
    registerWithEureka: false
    fetchRegistry: false
  server:
    waitTimeInMsWhenSyncEmpty: 0
    enableSelfPreservation: false
```

### 2. Config Server

```java
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }
}

application.yml:
```yaml
server:
  port: 8888

spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/your-org/config-repo
          searchPaths: '{application}'
          default-label: main
        encrypt:
          enabled: false

  security:
    user:
      name: ${CONFIG_SERVER_USER:admin}
      password: ${CONFIG_SERVER_PASSWORD:secret}
```

### 3. Circuit Breaker with Resilience4j

```java
@Configuration
public class CircuitBreakerConfig {
    @Bean
    public Customizer<Resilience4JCircuitBreakerFactory>
            defaultCustomizer() {
        return factory -> factory.configureDefault(id -> new
            Resilience4JConfigBuilder(id)
                .circuitBreakerConfig(CircuitBreakerConfig.custom()
                    .slidingWindowType(
                        SlidingWindowType.COUNT_BASED)
                    .slidingWindowSize(10)
                    .failureRateThreshold(50)
                    .waitDurationInOpenState(
                        Duration.ofSeconds(10))
                    .permittedNumberOfCallsInHalfOpenState(3)
                    .build())
                .timeLimiterConfig(TimeLimiterConfig.custom()
                    .timeoutDuration(Duration.ofSeconds(2))
                    .build())
                .build());
    }
}

@Service
@Slf4j
public class ResilientService {
    private final CircuitBreakerFactory circuitBreakerFactory;
    private final WebClient.Builder webClientBuilder;

    public <T> Mono<T> executeWithCircuitBreaker(
            String circuitBreakerId,
            Supplier<Mono<T>> supplier) {
        CircuitBreaker circuitBreaker = circuitBreakerFactory
            .create(circuitBreakerId);

        return Mono.fromSupplier(supplier)
            .transform(it -> circuitBreaker.run(it,
                throwable -> handleError(throwable)));
    }

    private <T> Mono<T> handleError(Throwable throwable) {
        log.error("Circuit breaker triggered", throwable);
        return Mono.error(new ServiceException(
            "Service unavailable", throwable));
    }
}
```

## Real-World Examples

### 1. API Gateway with Spring Cloud Gateway

```java
@SpringBootApplication
@EnableDiscoveryClient
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}

application.yml:
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - name: CircuitBreaker
              args:
                name: userService
                fallbackUri: forward:/fallback/users
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 20
            - name: RetryFilter
              args:
                retries: 3
                statuses: BAD_GATEWAY
                methods: GET
                backoff:
                  firstBackoff: 100ms
                  maxBackoff: 500ms
                  factor: 2
                  basedOnPreviousValue: false

        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - name: CircuitBreaker
              args:
                name: orderService
                fallbackUri: forward:/fallback/orders
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 20
                redis-rate-limiter.burstCapacity: 40

  redis:
    host: localhost
    port: 6379
```

### 2. Distributed Configuration

```java
@RestController
@RefreshScope
@RequestMapping("/api/v1/config")
public class ConfigController {
    @Value("${app.feature.enabled:false}")
    private boolean featureEnabled;

    @Value("${app.message:Default message}")
    private String message;

    @GetMapping("/features")
    public ResponseEntity<Map<String, Object>> getConfig() {
        return ResponseEntity.ok(Map.of(
            "featureEnabled", featureEnabled,
            "message", message
        ));
    }
}

bootstrap.yml:
```yaml
spring:
  application:
    name: my-service
  cloud:
    config:
      uri: http://config-server:8888
      fail-fast: true
      retry:
        initial-interval: 1000
        multiplier: 1.5
        max-interval: 5000
        max-attempts: 6
```

### 3. Distributed Tracing

```java
@Configuration
public class TracingConfig {
    @Bean
    public Sampler defaultSampler() {
        return Sampler.ALWAYS_SAMPLE;
    }
}

@Service
@Slf4j
public class TracedService {
    private final Tracer tracer;
    private final WebClient.Builder webClientBuilder;

    public Mono<Response> executeTracedOperation(
            String operationName,
            Request request) {
        Span span = tracer.nextSpan()
            .name(operationName)
            .tag("request.id", request.getId())
            .start();

        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            return processRequest(request)
                .doOnSuccess(response ->
                    span.tag("response.status", "success"))
                .doOnError(error -> {
                    span.tag("error", error.getMessage());
                    span.tag("response.status", "error");
                })
                .doFinally(signalType -> span.finish());
        }
    }

    private Mono<Response> processRequest(Request request) {
        return webClientBuilder.build()
            .post()
            .uri("http://processing-service/api/v1/process")
            .bodyValue(request)
            .retrieve()
            .bodyToMono(Response.class);
    }
}
```

## Common Pitfalls

1. ❌ Hardcoded configuration
   ✅ Use Config Server

2. ❌ No service discovery
   ✅ Implement Eureka

3. ❌ Missing circuit breakers
   ✅ Use Resilience4j

4. ❌ No distributed tracing
   ✅ Implement Sleuth/Zipkin

## Best Practices

1. Use service discovery
2. Centralize configuration
3. Implement circuit breakers
4. Enable distributed tracing
5. Use API gateway
6. Monitor services
7. Implement retry policies
8. Use rate limiting

## Knowledge Check

- [ ] Configure Eureka Server
- [ ] Set up Config Server
- [ ] Implement Circuit Breakers
- [ ] Configure API Gateway
- [ ] Enable Distributed Tracing
- [ ] Implement Rate Limiting

## Additional Resources

- [Spring Cloud](https://spring.io/projects/spring-cloud)
- [Spring Cloud Config](https://cloud.spring.io/spring-cloud-config/reference/html/)
- [Spring Cloud Netflix](https://cloud.spring.io/spring-cloud-netflix/reference/html/)
- [Spring Cloud Gateway](https://cloud.spring.io/spring-cloud-gateway/reference/html/)

---

⬅️ Previous: [Microservices Introduction](./29-microservices-intro.md)

➡️ Next: [Microservices Development](./31-microservices-dev.md)