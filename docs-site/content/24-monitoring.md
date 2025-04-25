# Monitoring in Spring Boot 📊

## Overview

Master monitoring and observability in Spring Boot applications. Learn about metrics collection, logging, tracing, and health checks using Spring Boot Actuator, Micrometer, and other monitoring tools.

## Core Concepts

### 1. Metrics Configuration

```java
@Configuration
public class MetricsConfig {
    @Bean
    MeterRegistry meterRegistry() {
        CompositeMeterRegistry registry = new CompositeMeterRegistry();
        registry.add(new SimpleMeterRegistry());
        registry.add(new JmxMeterRegistry(
            JmxConfig.DEFAULT,
            Clock.SYSTEM
        ));
        return registry;
    }

    @Bean
    TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }

    @Bean
    public Counter requestCounter(MeterRegistry registry) {
        return Counter.builder("http.requests.total")
            .description("Total number of HTTP requests")
            .register(registry);
    }

    @Bean
    public Timer responseTimeTimer(MeterRegistry registry) {
        return Timer.builder("http.request.duration")
            .description("HTTP request response time")
            .register(registry);
    }
}
```

### 2. Logging Configuration

```java
@Configuration
@EnableAspectJAutoProxy
public class LoggingConfig {
    @Bean
    public LoggingAspect loggingAspect() {
        return new LoggingAspect();
    }
}

@Aspect
@Slf4j
public class LoggingAspect {
    @Around("@annotation(LogExecutionTime)")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        Object proceed = joinPoint.proceed();
        long executionTime = System.currentTimeMillis() - start;

        log.info("{} executed in {} ms", joinPoint.getSignature(), executionTime);
        return proceed;
    }

    @AfterThrowing(pointcut = "execution(* com.example..*.*(..))", throwing = "ex")
    public void logError(JoinPoint joinPoint, Exception ex) {
        log.error("Exception in {}.{}() with cause = {}",
            joinPoint.getSignature().getDeclaringTypeName(),
            joinPoint.getSignature().getName(),
            ex.getCause() != null ? ex.getCause() : "NULL");
    }
}
```

### 3. Health Indicators

```java
@Component
public class CustomHealthIndicator implements HealthIndicator {
    private final DataSource dataSource;
    private final RestTemplate restTemplate;

    @Override
    public Health health() {
        try {
            checkDatabase();
            checkExternalServices();
            return Health.up()
                .withDetail("database", "UP")
                .withDetail("externalServices", "UP")
                .build();
        } catch (Exception e) {
            return Health.down()
                .withDetail("error", e.getMessage())
                .build();
        }
    }

    private void checkDatabase() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SELECT 1");
            }
        }
    }

    private void checkExternalServices() {
        restTemplate.getForEntity("https://api.example.com/health", String.class);
    }
}
```

## Real-World Examples

### 1. Performance Monitoring Service

```java
@Service
@Slf4j
public class PerformanceMonitoringService {
    private final MeterRegistry meterRegistry;
    private final AlertingService alertingService;

    @Timed(value = "service.operation.time", description = "Time taken to execute service operation")
    public void monitorServiceOperation(String operationName) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            executeOperation(operationName);
            sample.stop(meterRegistry.timer("operation.success", "name", operationName));
        } catch (Exception e) {
            sample.stop(meterRegistry.timer("operation.failure", "name", operationName));
            throw e;
        }
    }

    @Scheduled(fixedRate = 60000)
    public void checkPerformanceMetrics() {
        Timer timer = meterRegistry.timer("operation.success");
        double p95 = timer.totalTime(TimeUnit.MILLISECONDS) * 0.95;

        if (p95 > 1000) {
            alertingService.sendAlert(
                String.format("High response time detected: p95 = %.2f ms", p95)
            );
        }

        Counter errorCounter = meterRegistry.counter("operation.errors");
        if (errorCounter.count() > 100) {
            alertingService.sendAlert(
                String.format("High error rate detected: %d errors", (int) errorCounter.count())
            );
        }
    }

    private void executeOperation(String operationName) {
        // Simulated operation execution
        try {
            Thread.sleep(new Random().nextInt(100));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

### 2. Resource Monitoring Service

```java
@Service
@Slf4j
public class ResourceMonitoringService {
    private final MeterRegistry meterRegistry;
    private final AlertingService alertingService;

    @PostConstruct
    public void init() {
        // Monitor JVM metrics
        new JvmMemoryMetrics().bindTo(meterRegistry);
        new JvmGcMetrics().bindTo(meterRegistry);
        new ProcessorMetrics().bindTo(meterRegistry);
        new JvmThreadMetrics().bindTo(meterRegistry);

        // Custom resource metrics
        Gauge.builder("system.cpu.usage", this, this::getCpuUsage)
            .description("CPU Usage")
            .register(meterRegistry);

        Gauge.builder("system.memory.usage", this, this::getMemoryUsage)
            .description("Memory Usage")
            .register(meterRegistry);
    }

    @Scheduled(fixedRate = 30000)
    public void monitorResources() {
        double cpuUsage = getCpuUsage();
        double memoryUsage = getMemoryUsage();

        if (cpuUsage > 80) {
            alertingService.sendAlert(
                String.format("High CPU usage detected: %.2f%%", cpuUsage)
            );
        }

        if (memoryUsage > 85) {
            alertingService.sendAlert(
                String.format("High memory usage detected: %.2f%%", memoryUsage)
            );
        }
    }

    private double getCpuUsage() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
            return ((com.sun.management.OperatingSystemMXBean) osBean).getSystemCpuLoad() * 100;
        }
        return -1;
    }

    private double getMemoryUsage() {
        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        return ((double) (totalMemory - freeMemory) / totalMemory) * 100;
    }
}
```

### 3. Application Health Service

```java
@Service
@Slf4j
public class ApplicationHealthService {
    private final HealthIndicator databaseHealth;
    private final HealthIndicator cacheHealth;
    private final HealthIndicator externalServiceHealth;
    private final AlertingService alertingService;

    @Scheduled(fixedRate = 30000)
    public void checkApplicationHealth() {
        Map<String, Health> healthChecks = new HashMap<>();
        healthChecks.put("database", databaseHealth.health());
        healthChecks.put("cache", cacheHealth.health());
        healthChecks.put("externalService", externalServiceHealth.health());

        List<String> unhealthyComponents = healthChecks.entrySet().stream()
            .filter(entry -> entry.getValue().getStatus() == Status.DOWN)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

        if (!unhealthyComponents.isEmpty()) {
            String message = String.format("Unhealthy components detected: %s",
                String.join(", ", unhealthyComponents));
            alertingService.sendAlert(message);
            log.error(message);
        }

        // Record metrics
        healthChecks.forEach((component, health) -> {
            Gauge.builder("application.health", health,
                h -> h.getStatus() == Status.UP ? 1 : 0)
                .tag("component", component)
                .description("Application health status")
                .register(new SimpleMeterRegistry());
        });
    }

    @Scheduled(cron = "0 0 * * * *")
    public void generateHealthReport() {
        try {
            Map<String, Object> report = new HashMap<>();
            report.put("timestamp", LocalDateTime.now());
            report.put("uptime", ManagementFactory.getRuntimeMXBean().getUptime());
            report.put("healthChecks", collectHealthMetrics());
            report.put("performance", collectPerformanceMetrics());

            log.info("Health Report: {}", report);
            // Store or send the report
        } catch (Exception e) {
            log.error("Failed to generate health report", e);
        }
    }

    private Map<String, Object> collectHealthMetrics() {
        // Implementation for collecting health metrics
        return new HashMap<>();
    }

    private Map<String, Object> collectPerformanceMetrics() {
        // Implementation for collecting performance metrics
        return new HashMap<>();
    }
}
```

## Common Pitfalls

1. ❌ Not monitoring critical metrics
   ✅ Monitor key business and technical metrics

2. ❌ Excessive logging
   ✅ Use appropriate log levels and sampling

3. ❌ Missing alerts
   ✅ Set up proper alerting thresholds

4. ❌ Inadequate health checks
   ✅ Implement comprehensive health indicators

## Best Practices

1. Use appropriate log levels
2. Implement structured logging
3. Set up proper metric tags
4. Configure meaningful health checks
5. Implement proper alerting
6. Use distributed tracing
7. Monitor business metrics
8. Regular monitoring review

## Knowledge Check

- [ ] Configure Actuator endpoints
- [ ] Set up custom metrics
- [ ] Implement health indicators
- [ ] Configure logging
- [ ] Set up alerts
- [ ] Implement tracing

## Additional Resources

- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [Micrometer Documentation](https://micrometer.io/docs)
- [OpenTelemetry](https://opentelemetry.io/)
- [ELK Stack](https://www.elastic.co/elastic-stack)

---

⬅️ Previous: [Security](./23-security.md)

➡️ Next: [Documentation](./16-documentation.md)