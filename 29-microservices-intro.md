# Spring Boot Microservices Introduction 🔄

## Overview

Master microservices architecture with Spring Boot. Learn about microservices principles, patterns, and best practices for building distributed systems.

## Core Concepts

### 1. Microservice Architecture

```java
@SpringBootApplication
@EnableDiscoveryClient
public class UserServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(UserServiceApplication.class, args);
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}

application.yml:
```yaml
spring:
  application:
    name: user-service
  cloud:
    discovery:
      enabled: true
    loadbalancer:
      ribbon:
        enabled: false

server:
  port: 8081

eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/
  instance:
    preferIpAddress: true
```

### 2. Service Discovery

```java
@Configuration
@EnableEurekaServer
public class EurekaServerConfig {
    // Eureka server configuration
}

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private final RestTemplate restTemplate;
    private final DiscoveryClient discoveryClient;

    public ResponseEntity<OrderResponse> getUserOrders(
            @PathVariable Long userId) {
        List<ServiceInstance> instances = discoveryClient
            .getInstances("order-service");

        if (instances.isEmpty()) {
            throw new ServiceNotFoundException(
                "Order service not available");
        }

        String baseUrl = instances.get(0).getUri().toString();
        return restTemplate.getForEntity(
            baseUrl + "/api/v1/orders?userId=" + userId,
            OrderResponse.class);
    }
}
```

### 3. Load Balancing

```java
@Configuration
public class LoadBalancerConfig {
    @Bean
    @LoadBalanced
    public WebClient.Builder loadBalancedWebClientBuilder() {
        return WebClient.builder();
    }

    @Bean
    public ReactorLoadBalancerExchangeFilterFunction lbFunction(
            LoadBalancerRegistry registry) {
        return new ReactorLoadBalancerExchangeFilterFunction(
            registry);
    }
}

@Service
public class OrderService {
    private final WebClient.Builder webClientBuilder;

    public Mono<OrderResponse> getOrders(Long userId) {
        return webClientBuilder.build()
            .get()
            .uri("http://order-service/api/v1/orders?userId="
                + userId)
            .retrieve()
            .bodyToMono(OrderResponse.class);
    }
}
```

## Real-World Examples

### 1. E-commerce Microservices

```java
@Service
@Slf4j
public class ProductService {
    private final WebClient.Builder webClientBuilder;
    private final CircuitBreakerFactory circuitBreakerFactory;

    public Mono<ProductDetails> getProductDetails(
            String productId) {
        return circuitBreakerFactory
            .create("product-details")
            .run(Mono.zip(
                getProduct(productId),
                getInventory(productId),
                getReviews(productId)
            ).map(tuple -> {
                Product product = tuple.getT1();
                Inventory inventory = tuple.getT2();
                List<Review> reviews = tuple.getT3();

                return new ProductDetails(
                    product, inventory, reviews);
            }), throwable -> handleError(throwable));
    }

    private Mono<Product> getProduct(String productId) {
        return webClientBuilder.build()
            .get()
            .uri("http://product-service/api/v1/products/"
                + productId)
            .retrieve()
            .bodyToMono(Product.class);
    }

    private Mono<Inventory> getInventory(String productId) {
        return webClientBuilder.build()
            .get()
            .uri("http://inventory-service/api/v1/inventory/"
                + productId)
            .retrieve()
            .bodyToMono(Inventory.class);
    }

    private Mono<List<Review>> getReviews(String productId) {
        return webClientBuilder.build()
            .get()
            .uri("http://review-service/api/v1/reviews?productId="
                + productId)
            .retrieve()
            .bodyToFlux(Review.class)
            .collectList();
    }
}
```

### 2. Authentication Service

```java
@Service
@Slf4j
public class AuthenticationService {
    private final WebClient.Builder webClientBuilder;
    private final TokenService tokenService;
    private final UserService userService;

    public Mono<AuthResponse> authenticate(
            AuthRequest request) {
        return userService.validateCredentials(request)
            .flatMap(user -> {
                String token = tokenService.generateToken(user);

                return notifyServices(user, token)
                    .thenReturn(new AuthResponse(token));
            });
    }

    private Flux<Void> notifyServices(User user, String token) {
        return Flux.merge(
            notifyService("order-service", user, token),
            notifyService("payment-service", user, token),
            notifyService("shipping-service", user, token)
        );
    }

    private Mono<Void> notifyService(String service,
            User user,
            String token) {
        return webClientBuilder.build()
            .post()
            .uri("http://" + service + "/api/v1/auth/notify")
            .bodyValue(new AuthNotification(user.getId(), token))
            .retrieve()
            .bodyToMono(Void.class)
            .onErrorResume(e -> {
                log.error("Failed to notify {}: {}",
                    service, e.getMessage());
                return Mono.empty();
            });
    }
}
```

### 3. Notification Service

```java
@Service
@Slf4j
public class NotificationService {
    private final KafkaTemplate<String, Event> kafkaTemplate;
    private final WebClient.Builder webClientBuilder;
    private final NotificationRepository repository;

    public Mono<Void> processNotification(
            NotificationRequest request) {
        return Mono.fromCallable(() -> {
            Event event = createEvent(request);
            return kafkaTemplate.send("notifications",
                event.getKey(), event);
        })
        .then(enrichNotification(request))
        .flatMap(this::sendNotification)
        .doOnSuccess(v ->
            log.info("Notification processed: {}",
                request.getId()))
        .doOnError(e ->
            log.error("Notification failed: {}",
                request.getId(), e));
    }

    private Mono<EnrichedNotification> enrichNotification(
            NotificationRequest request) {
        return Mono.zip(
            getUserDetails(request.getUserId()),
            getTemplateDetails(request.getTemplateId())
        ).map(tuple -> {
            UserDetails user = tuple.getT1();
            Template template = tuple.getT2();

            return new EnrichedNotification(
                request, user, template);
        });
    }

    private Mono<Void> sendNotification(
            EnrichedNotification notification) {
        return Flux.fromIterable(
            notification.getChannels())
            .flatMap(channel ->
                sendToChannel(channel, notification))
            .then();
    }

    private Mono<Void> sendToChannel(String channel,
            EnrichedNotification notification) {
        return webClientBuilder.build()
            .post()
            .uri("http://" + channel +
                "-service/api/v1/send")
            .bodyValue(notification)
            .retrieve()
            .bodyToMono(Void.class)
            .retryWhen(Retry.backoff(3,
                Duration.ofSeconds(1)));
    }
}
```

## Common Pitfalls

1. ❌ Tight coupling between services
   ✅ Use event-driven architecture

2. ❌ Synchronous communication
   ✅ Implement async communication

3. ❌ No fallback mechanisms
   ✅ Implement circuit breakers

4. ❌ Poor service discovery
   ✅ Use service registry

## Best Practices

1. Design for failure
2. Implement circuit breakers
3. Use async communication
4. Implement service discovery
5. Use load balancing
6. Monitor services
7. Implement distributed tracing
8. Use API gateways

# Real-World Problems Faced in Microservices Architecture

## 1. Service Communication Failures
- **Problem:** Network failures, timeout errors, or unresponsive downstream services can cause major disruptions.
- **Example:** A Payment Service depends on the Inventory Service, but if Inventory is slow or down, payments fail or hang indefinitely.

## 2. Data Consistency Issues
- **Problem:** Since each service has its own database, ensuring data consistency across services (especially during transactions) becomes complex.
- **Example:** In an e-commerce app, if the Order Service saves the order but the Inventory Service fails to update the stock, the systems are out of sync.

## 3. Distributed System Complexity
- **Problem:** Debugging, tracing, and managing distributed systems is harder compared to monolithic systems.
- **Example:** Tracking a user request across multiple services (like authentication, catalog, and checkout) can become a nightmare without proper observability tools.

## 4. Versioning and Backward Compatibility
- **Problem:** Updating a service without breaking others is tricky. New versions must be backward-compatible or have careful migration strategies.
- **Example:** If the API contract of the Customer Service changes, all dependent services must adapt, which can cause cascading failures.

## 5. Deployment and Environment Management
- **Problem:** Managing deployments for multiple services (dev, staging, prod) becomes complex and resource-heavy.
- **Example:** A simple feature release may require deploying 5–10 interdependent

## Knowledge Check

- [ ] Understand microservices architecture
- [ ] Implement service discovery
- [ ] Configure load balancing
- [ ] Handle service failures
- [ ] Implement async communication
- [ ] Use circuit breakers

## Additional Resources

- [Spring Cloud](https://spring.io/projects/spring-cloud)
- [Netflix OSS](https://netflix.github.io/)
- [Microservices Patterns](https://microservices.io/patterns/index.html)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

---

⬅️ Previous: [External APIs](./28-external-apis.md)

➡️ Next: [Spring Cloud](./30-spring-cloud.md)