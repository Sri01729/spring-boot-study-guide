# Spring Boot Actuator 📊

## Overview

Master Spring Boot Actuator for monitoring and managing your applications. Learn about built-in endpoints, metrics collection, health checks, and custom endpoints for application insights.

## Core Concepts

### 1. Actuator Configuration

```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Optional: Prometheus metrics -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```properties
# application.properties
management.endpoints.web.exposure.include=*
management.endpoints.web.base-path=/actuator
management.endpoint.health.show-details=always
management.endpoint.health.show-components=always
management.endpoints.web.exposure.exclude=shutdown

# Prometheus endpoint
management.metrics.export.prometheus.enabled=true
management.metrics.tags.application=${spring.application.name}

# Info endpoint customization
management.info.env.enabled=true
management.info.java.enabled=true
management.info.git.enabled=true
info.app.name=@project.name@
info.app.version=@project.version@
```

### 2. Custom Health Indicator

```java
@Component
public class DatabaseHealthIndicator implements HealthIndicator {
    private final DataSource dataSource;

    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection()) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SELECT 1");
                return Health.up()
                    .withDetail("database", "PostgreSQL")
                    .withDetail("status", "Connected")
                    .build();
            }
        } catch (SQLException e) {
            return Health.down()
                .withDetail("database", "PostgreSQL")
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}

@Component
public class ExternalServiceHealthIndicator implements HealthIndicator {
    private final WebClient webClient;
    private final String serviceUrl;

    @Override
    public Health health() {
        try {
            ResponseEntity<String> response = webClient
                .get()
                .uri(serviceUrl + "/health")
                .retrieve()
                .toEntity(String.class)
                .block(Duration.ofSeconds(5));

            if (response.getStatusCode().is2xxSuccessful()) {
                return Health.up()
                    .withDetail("service", serviceUrl)
                    .withDetail("status", "Available")
                    .build();
            }

            return Health.down()
                .withDetail("service", serviceUrl)
                .withDetail("status", response.getStatusCode())
                .build();
        } catch (Exception e) {
            return Health.down()
                .withDetail("service", serviceUrl)
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}
```

### 3. Custom Actuator Endpoint

```java
@Component
@Endpoint(id = "features")
public class FeaturesEndpoint {
    private final FeatureManager featureManager;

    @ReadOperation
    public Map<String, Object> getFeatures() {
        Map<String, Object> features = new HashMap<>();
        features.put("features", featureManager.getEnabledFeatures());
        features.put("lastUpdated", LocalDateTime.now());
        return features;
    }

    @WriteOperation
    public void setFeature(@Selector String name, @Nullable Boolean enabled) {
        featureManager.setFeatureEnabled(name, enabled != null ? enabled : false);
    }

    @DeleteOperation
    public void deleteFeature(@Selector String name) {
        featureManager.removeFeature(name);
    }
}
```

## Real-World Examples

### 1. Custom Metrics Collection

```java
@Configuration
public class MetricsConfig {
    @Bean
    MeterRegistryCustomizer<MeterRegistry> metricsCommonTags(
            @Value("${spring.application.name}") String applicationName) {
        return registry -> registry.config()
            .commonTags("application", applicationName);
    }
}

@Service
@RequiredArgsConstructor
public class OrderMetricsService {
    private final MeterRegistry meterRegistry;

    public void recordOrderCreation(Order order) {
        meterRegistry.counter("orders.created",
            "type", order.getType(),
            "status", order.getStatus().name())
            .increment();

        meterRegistry.gauge("orders.amount",
            Tags.of(
                Tag.of("type", order.getType()),
                Tag.of("status", order.getStatus().name())
            ),
            order.getTotalAmount().doubleValue());
    }

    public void recordOrderProcessingTime(long startTime) {
        meterRegistry.timer("orders.processing.time")
            .record(System.currentTimeMillis() - startTime, TimeUnit.MILLISECONDS);
    }

    @Scheduled(fixedRate = 60000)
    public void recordQueueMetrics() {
        meterRegistry.gauge("orders.queue.size",
            orderQueue.size());
    }
}
```

### 2. Advanced Health Indicators

```java
@Component
public class CompositeHealthIndicator implements HealthIndicator {
    private final Map<String, HealthIndicator> indicators;
    private final HealthAggregator healthAggregator;

    @Override
    public Health health() {
        Map<String, Health> healths = new HashMap<>();

        indicators.forEach((name, indicator) -> {
            try {
                healths.put(name, indicator.health());
            } catch (Exception e) {
                healths.put(name, Health.down(e).build());
            }
        });

        return healthAggregator.aggregate(healths);
    }
}

@Component
public class CacheHealthIndicator implements HealthIndicator {
    private final CacheManager cacheManager;

    @Override
    public Health health() {
        Map<String, Object> details = new HashMap<>();
        boolean isUp = true;

        for (String cacheName : cacheManager.getCacheNames()) {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache instanceof CaffeineCache) {
                com.github.benmanes.caffeine.cache.Cache<Object, Object> nativeCache =
                    ((CaffeineCache) cache).getNativeCache();

                details.put(cacheName + ".size", nativeCache.estimatedSize());
                details.put(cacheName + ".stats", nativeCache.stats().toString());

                if (nativeCache.estimatedSize() >= nativeCache.policy().eviction()
                        .map(policy -> policy.getMaximum()).orElse(Long.MAX_VALUE)) {
                    isUp = false;
                }
            }
        }

        return isUp ? Health.up().withDetails(details).build() :
                     Health.down().withDetails(details).build();
    }
}
```

### 3. Custom Info Contributor

```java
@Component
public class BuildInfoContributor implements InfoContributor {
    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("build", Map.of(
            "version", getBuildVersion(),
            "timestamp", getBuildTimestamp(),
            "commit", getGitCommit(),
            "branch", getGitBranch()
        ));
    }
}

@Component
public class SystemInfoContributor implements InfoContributor {
    @Override
    public void contribute(Info.Builder builder) {
        Runtime runtime = Runtime.getRuntime();

        builder.withDetail("system", Map.of(
            "processors", runtime.availableProcessors(),
            "memory", Map.of(
                "free", runtime.freeMemory(),
                "total", runtime.totalMemory(),
                "max", runtime.maxMemory()
            ),
            "disk", getDiskSpace(),
            "os", getOperatingSystem()
        ));
    }
}
```

## Common Pitfalls

1. ❌ Exposing sensitive endpoints
   ✅ Configure endpoint security properly

2. ❌ High memory usage from metrics
   ✅ Configure appropriate metric filters

3. ❌ Slow health checks
   ✅ Implement efficient health indicators

4. ❌ Missing critical metrics
   ✅ Define comprehensive monitoring strategy

## Best Practices

1. Secure actuator endpoints
2. Use appropriate metric types
3. Implement custom health checks
4. Configure proper logging
5. Monitor memory usage
6. Set up alerts
7. Use meaningful metric names
8. Document custom endpoints

## Knowledge Check

- [ ] Configure Actuator endpoints
- [ ] Create custom health indicators
- [ ] Implement custom metrics
- [ ] Set up Prometheus integration
- [ ] Create custom endpoints
- [ ] Configure security for endpoints

## Additional Resources

- [Spring Boot Actuator Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [Micrometer Documentation](https://micrometer.io/docs)
- [Prometheus Documentation](https://prometheus.io/docs/introduction/overview/)
- [Grafana Documentation](https://grafana.com/docs/)

---

⬅️ Previous: [API Documentation](./19-api-docs.md)

➡️ Next: [Logging](./21-logging.md)