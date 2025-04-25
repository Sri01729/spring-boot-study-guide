# Spring Boot External APIs Integration 🌐

## Overview

Master external API integration in Spring Boot applications. Learn about REST clients, API configuration, error handling, and best practices for reliable external service communication.

## Core Concepts

### 1. REST Client Configuration

```java
@Configuration
public class RestClientConfig {
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(5))
            .additionalInterceptors(new LoggingInterceptor())
            .errorHandler(new CustomResponseErrorHandler())
            .build();
    }

    @Bean
    public WebClient webClient(WebClient.Builder builder) {
        return builder
            .baseUrl("https://api.example.com")
            .defaultHeader(HttpHeaders.CONTENT_TYPE,
                MediaType.APPLICATION_JSON_VALUE)
            .filter(ExchangeFilterFunction.ofRequestProcessor(
                clientRequest -> {
                    log.debug("Request: {} {}",
                        clientRequest.method(),
                        clientRequest.url());
                    return Mono.just(clientRequest);
                }
            ))
            .filter(ExchangeFilterFunction.ofResponseProcessor(
                clientResponse -> {
                    log.debug("Response status: {}",
                        clientResponse.statusCode());
                    return Mono.just(clientResponse);
                }
            ))
            .build();
    }
}

@Component
@Slf4j
public class LoggingInterceptor
        implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request,
            byte[] body,
            ClientHttpRequestExecution execution) throws IOException {

        logRequest(request, body);
        ClientHttpResponse response = execution.execute(request, body);
        logResponse(response);
        return response;
    }
}

@Component
public class CustomResponseErrorHandler
        implements ResponseErrorHandler {

    @Override
    public boolean hasError(ClientHttpResponse response)
            throws IOException {
        return response.getStatusCode().isError();
    }

    @Override
    public void handleError(ClientHttpResponse response)
            throws IOException {
        if (response.getStatusCode().is4xxClientError()) {
            throw new ApiClientException(
                "Client error: " + response.getStatusCode());
        } else if (response.getStatusCode().is5xxServerError()) {
            throw new ApiServerException(
                "Server error: " + response.getStatusCode());
        }
    }
}
```

### 2. API Client Service

```java
@Service
@Slf4j
public class ApiClientService {
    private final WebClient webClient;
    private final CircuitBreakerFactory circuitBreakerFactory;
    private final RetryTemplate retryTemplate;

    public <T> Mono<T> get(String path, Class<T> responseType) {
        return webClient.get()
            .uri(path)
            .retrieve()
            .bodyToMono(responseType)
            .transform(it -> circuitBreakerFactory
                .create("api-get")
                .run(it, throwable -> handleError(throwable)))
            .retryWhen(Retry.backoff(3, Duration.ofSeconds(1))
                .filter(this::isRetryable));
    }

    public <T> Mono<T> post(String path,
            Object request,
            Class<T> responseType) {
        return webClient.post()
            .uri(path)
            .bodyValue(request)
            .retrieve()
            .bodyToMono(responseType)
            .transform(it -> circuitBreakerFactory
                .create("api-post")
                .run(it, throwable -> handleError(throwable)))
            .retryWhen(Retry.backoff(3, Duration.ofSeconds(1))
                .filter(this::isRetryable));
    }

    private <T> Mono<T> handleError(Throwable throwable) {
        log.error("API call failed", throwable);
        return Mono.error(new ApiException(
            "API call failed", throwable));
    }

    private boolean isRetryable(Throwable throwable) {
        return throwable instanceof ApiServerException ||
               throwable instanceof TimeoutException;
    }
}
```

### 3. API Response Caching

```java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager =
            new CaffeineCacheManager();

        cacheManager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(1, TimeUnit.HOURS)
            .maximumSize(100));

        return cacheManager;
    }
}

@Service
@Slf4j
public class CachedApiService {
    private final ApiClientService apiClient;
    private final CacheManager cacheManager;

    @Cacheable(cacheNames = "api-responses",
        key = "#path",
        unless = "#result == null")
    public <T> T getWithCache(String path,
            Class<T> responseType) {
        return apiClient.get(path, responseType)
            .block(Duration.ofSeconds(5));
    }

    @CacheEvict(cacheNames = "api-responses",
        key = "#path")
    public void invalidateCache(String path) {
        log.info("Invalidating cache for path: {}", path);
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    public void refreshCache() {
        Cache cache = cacheManager.getCache("api-responses");
        if (cache != null) {
            cache.clear();
        }
    }
}
```

## Real-World Examples

### 1. Payment Gateway Integration

```java
@Service
@Slf4j
public class PaymentService {
    private final ApiClientService apiClient;
    private final TransactionRepository transactionRepository;
    private final NotificationService notificationService;

    @Transactional
    public PaymentResponse processPayment(
            PaymentRequest request) {
        log.info("Processing payment for order: {}",
            request.getOrderId());

        Transaction transaction = createTransaction(request);

        try {
            PaymentResponse response = apiClient.post(
                "/payments",
                request,
                PaymentResponse.class)
                .block(Duration.ofSeconds(10));

            updateTransaction(transaction, response);

            if (response.isSuccessful()) {
                notificationService.sendPaymentConfirmation(
                    request.getOrderId());
            }

            return response;
        } catch (Exception e) {
            handlePaymentError(transaction, e);
            throw new PaymentException(
                "Payment processing failed", e);
        }
    }

    @Async
    public CompletableFuture<PaymentStatus> checkPaymentStatus(
            String paymentId) {
        return CompletableFuture.supplyAsync(() -> {
            return apiClient.get(
                "/payments/" + paymentId,
                PaymentStatus.class)
                .block(Duration.ofSeconds(5));
        });
    }

    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void reconcilePayments() {
        List<Transaction> pendingTransactions =
            transactionRepository
                .findByStatus(TransactionStatus.PENDING);

        pendingTransactions.forEach(transaction -> {
            try {
                PaymentStatus status = checkPaymentStatus(
                    transaction.getPaymentId())
                    .get(5, TimeUnit.SECONDS);

                updateTransactionStatus(transaction, status);
            } catch (Exception e) {
                log.error("Failed to reconcile payment: {}",
                    transaction.getId(), e);
            }
        });
    }
}
```

### 2. Weather Service Integration

```java
@Service
@Slf4j
public class WeatherService {
    private final ApiClientService apiClient;
    private final CachedApiService cachedApiClient;
    private final MetricsService metricsService;

    @Cacheable(cacheNames = "weather",
        key = "#location",
        unless = "#result == null")
    public WeatherInfo getWeather(String location) {
        log.info("Fetching weather for location: {}",
            location);

        long startTime = System.currentTimeMillis();

        try {
            WeatherInfo weather = apiClient.get(
                "/weather?location=" + location,
                WeatherInfo.class)
                .block(Duration.ofSeconds(5));

            recordMetrics(location, startTime);

            return weather;
        } catch (Exception e) {
            log.error("Failed to fetch weather for: {}",
                location, e);
            throw new WeatherServiceException(
                "Weather service unavailable", e);
        }
    }

    @Scheduled(cron = "0 */30 * * * *") // Every 30 minutes
    public void updateWeatherCache() {
        List<String> popularLocations = getPopularLocations();

        popularLocations.forEach(location -> {
            try {
                getWeather(location);
            } catch (Exception e) {
                log.error("Failed to update weather cache for: {}",
                    location, e);
            }
        });
    }

    private void recordMetrics(String location, long startTime) {
        long duration = System.currentTimeMillis() - startTime;
        metricsService.recordApiCall(
            "weather",
            duration,
            "location", location);
    }
}
```

### 3. External Search Service

```java
@Service
@Slf4j
public class SearchService {
    private final ApiClientService apiClient;
    private final SearchResultRepository repository;
    private final AsyncSearchProcessor asyncProcessor;

    public SearchResponse search(SearchRequest request) {
        validateRequest(request);

        SearchResponse response = apiClient.post(
            "/search",
            request,
            SearchResponse.class)
            .block(Duration.ofSeconds(10));

        asyncProcessor.processResults(response);

        return response;
    }

    @Async
    public CompletableFuture<SearchResponse> asyncSearch(
            SearchRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return search(request);
            } catch (Exception e) {
                log.error("Async search failed", e);
                throw new SearchException(
                    "Search failed", e);
            }
        });
    }

    public Flux<SearchResult> streamSearch(
            SearchRequest request) {
        return apiClient.post(
            "/search/stream",
            request,
            SearchResult.class)
            .doOnNext(result ->
                asyncProcessor.processResult(result))
            .doOnError(error ->
                log.error("Stream search failed", error));
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    public void cleanupSearchResults() {
        LocalDateTime cutoff = LocalDateTime.now()
            .minusDays(7);

        repository.deleteByCreatedDateBefore(cutoff);
    }
}
```

## Common Pitfalls

1. ❌ Not handling timeouts
   ✅ Configure appropriate timeouts

2. ❌ Missing error handling
   ✅ Implement comprehensive error handling

3. ❌ No retry mechanism
   ✅ Use retry with backoff

4. ❌ Inefficient caching
   ✅ Implement proper caching strategy

## Best Practices

1. Configure appropriate timeouts
2. Implement circuit breakers
3. Use retry mechanisms
4. Cache responses
5. Log requests/responses
6. Monitor API calls
7. Handle errors gracefully
8. Use async operations

## Knowledge Check

- [ ] Configure REST clients
- [ ] Implement error handling
- [ ] Set up caching
- [ ] Use circuit breakers
- [ ] Implement retries
- [ ] Monitor API calls

## Additional Resources

- [Spring WebClient](https://docs.spring.io/spring-framework/docs/current/reference/html/web-reactive.html#webflux-client)
- [Spring RestTemplate](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#rest-client-access)
- [Circuit Breaker Pattern](https://resilience4j.readme.io/docs/circuitbreaker)
- [Spring Cache](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#cache)

---

⬅️ Previous: [Pagination](./27-pagination.md)

➡️ Next: [Microservices Introduction](./29-microservices-intro.md)