# Spring Boot Async Processing ⚡

## Overview

Master asynchronous processing in Spring Boot applications. Learn about async execution, thread pools, CompletableFuture, and best practices for handling concurrent operations.

## Core Concepts

### 1. Async Configuration

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {
    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("AsyncThread-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new SimpleAsyncUncaughtExceptionHandler();
    }

    @Bean(name = "customExecutor")
    public Executor customExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("CustomAsync-");
        executor.initialize();
        return executor;
    }
}
```

### 2. Async Service Methods

```java
@Service
@Slf4j
public class AsyncService {
    @Async
    public CompletableFuture<String> processAsync(String input) {
        log.info("Processing async task: {}", input);
        try {
            // Simulate long processing
            Thread.sleep(2000);
            return CompletableFuture.completedFuture(
                "Processed: " + input.toUpperCase()
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CompletableFuture.failedFuture(e);
        }
    }

    @Async("customExecutor")
    public Future<Integer> computeValue(int number) {
        return new AsyncResult<>(number * 2);
    }

    @Async
    public void fireAndForget(String message) {
        log.info("Async task started: {}", message);
        // Do something without returning result
    }
}
```

### 3. Async Exception Handling

```java
@Component
public class CustomAsyncExceptionHandler implements AsyncUncaughtExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(CustomAsyncExceptionHandler.class);

    @Override
    public void handleUncaughtException(Throwable ex, Method method, Object... params) {
        log.error("Async method {} failed with error: {}",
            method.getName(), ex.getMessage());

        if (ex instanceof BusinessException) {
            // Handle business exceptions
            notifyBusinessError((BusinessException) ex);
        } else {
            // Handle system exceptions
            notifySystemError(ex);
        }
    }

    private void notifyBusinessError(BusinessException ex) {
        // Implement business error notification
    }

    private void notifySystemError(Throwable ex) {
        // Implement system error notification
    }
}
```

## Real-World Examples

### 1. Parallel Processing Service

```java
@Service
@Slf4j
public class ParallelProcessingService {
    private final AsyncService asyncService;

    public List<String> processItemsInParallel(List<String> items) {
        List<CompletableFuture<String>> futures = items.stream()
            .map(asyncService::processAsync)
            .collect(Collectors.toList());

        return futures.stream()
            .map(CompletableFuture::join)
            .collect(Collectors.toList());
    }

    public CompletableFuture<List<String>> processItemsAsync(List<String> items) {
        List<CompletableFuture<String>> futures = items.stream()
            .map(asyncService::processAsync)
            .collect(Collectors.toList());

        return CompletableFuture.allOf(
            futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList()));
    }

    @Async
    public CompletableFuture<ProcessingResult> processWithRetry(String item) {
        return CompletableFuture.supplyAsync(() -> {
            int attempts = 0;
            while (attempts < 3) {
                try {
                    return processItem(item);
                } catch (Exception e) {
                    attempts++;
                    if (attempts == 3) {
                        throw new ProcessingException("Failed after 3 attempts", e);
                    }
                    log.warn("Retry attempt {} for item {}", attempts, item);
                    try {
                        Thread.sleep(1000 * attempts);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new ProcessingException("Interrupted during retry", ie);
                    }
                }
            }
            throw new ProcessingException("Unexpected processing failure");
        });
    }
}
```

### 2. Async Event Processing

```java
@Service
@Slf4j
public class AsyncEventProcessor {
    private final ApplicationEventPublisher eventPublisher;
    private final NotificationService notificationService;

    @EventListener
    @Async
    public void handleOrderCreatedEvent(OrderCreatedEvent event) {
        try {
            // Process order asynchronously
            Order order = event.getOrder();
            log.info("Processing order: {}", order.getId());

            // Send notifications
            CompletableFuture<Void> emailFuture = notificationService
                .sendEmailAsync(order.getCustomerEmail());
            CompletableFuture<Void> smsFuture = notificationService
                .sendSMSAsync(order.getCustomerPhone());

            CompletableFuture.allOf(emailFuture, smsFuture)
                .thenRun(() -> log.info("All notifications sent for order: {}",
                    order.getId()));
        } catch (Exception e) {
            log.error("Error processing order event", e);
            eventPublisher.publishEvent(new OrderProcessingFailedEvent(event.getOrder(), e));
        }
    }

    @Async
    public CompletableFuture<Void> processEvents(List<Event> events) {
        return CompletableFuture.runAsync(() -> {
            events.forEach(event -> {
                try {
                    processEvent(event);
                } catch (Exception e) {
                    log.error("Error processing event: {}", event.getId(), e);
                }
            });
        });
    }
}
```

### 3. Async REST Controller

```java
@RestController
@RequestMapping("/api/v1/tasks")
@Slf4j
public class AsyncTaskController {
    private final AsyncTaskService taskService;

    @PostMapping
    public CompletableFuture<ResponseEntity<TaskResult>> submitTask(
            @RequestBody @Valid TaskRequest request) {
        return taskService.processTask(request)
            .thenApply(result -> ResponseEntity.ok(result))
            .exceptionally(ex -> {
                log.error("Task processing failed", ex);
                return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new TaskResult("Failed: " + ex.getMessage()));
            });
    }

    @GetMapping("/batch")
    public CompletableFuture<ResponseEntity<List<TaskResult>>> processBatch(
            @RequestBody @Valid List<TaskRequest> requests) {
        List<CompletableFuture<TaskResult>> futures = requests.stream()
            .map(taskService::processTask)
            .collect(Collectors.toList());

        return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList()))
            .thenApply(ResponseEntity::ok)
            .exceptionally(ex -> {
                log.error("Batch processing failed", ex);
                return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.emptyList());
            });
    }
}
```

## Common Pitfalls

1. ❌ Using @Async on private methods
   ✅ Make async methods public

2. ❌ Not configuring thread pools
   ✅ Configure appropriate thread pool settings

3. ❌ Ignoring exception handling
   ✅ Implement proper async exception handling

4. ❌ Thread pool saturation
   ✅ Monitor and tune thread pool parameters

## Best Practices

1. Configure thread pools appropriately
2. Handle exceptions properly
3. Use CompletableFuture for complex flows
4. Monitor thread pool metrics
5. Implement proper timeouts
6. Use appropriate queue capacities
7. Consider thread naming patterns
8. Test concurrent operations

## Knowledge Check

- [ ] Configure async execution
- [ ] Implement async methods
- [ ] Handle async exceptions
- [ ] Use CompletableFuture
- [ ] Process events asynchronously
- [ ] Manage thread pools

## Additional Resources

- [Spring Async Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#scheduling)
- [CompletableFuture Guide](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/CompletableFuture.html)
- [Thread Pool Executor](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ThreadPoolExecutor.html)
- [Spring Task Execution](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#scheduling-task-executor)

---

⬅️ Previous: [Properties](./23-properties.md)

➡️ Next: [Validation](./25-validation.md)