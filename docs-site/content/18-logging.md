# Logging in Spring Boot 📝

## Overview

Master logging in Spring Boot applications. Learn about logging configuration, log levels, logging patterns, and best practices for effective application monitoring.

## Core Concepts

### 1. Logging Configuration

```properties
# application.properties
logging.level.root=INFO
logging.level.com.example.myapp=DEBUG
logging.level.org.springframework.web=WARN
logging.level.org.hibernate=ERROR

logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n
logging.pattern.file=%d{yyyy-MM-dd HH:mm:ss} [%X{traceId}/%X{spanId}] %-5level [%thread] %logger{36} - %msg%n

logging.file.name=logs/application.log
logging.file.max-size=10MB
logging.file.max-history=30

# Enable JSON logging for cloud environments
logging.config=classpath:logback-spring.xml
```

### 2. Logback Configuration

```xml
<!-- logback-spring.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <include resource="org/springframework/boot/logging/logback/defaults.xml"/>

    <springProperty scope="context" name="appName" source="spring.application.name"/>

    <appender name="Console" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeMdcKeyName>traceId</includeMdcKeyName>
            <includeMdcKeyName>spanId</includeMdcKeyName>
            <includeMdcKeyName>userId</includeMdcKeyName>
            <customFields>{"app_name":"${appName}"}</customFields>
        </encoder>
    </appender>

    <appender name="File" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/application.log</file>
        <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/archived/application.%d{yyyy-MM-dd}.log</fileNamePattern>
            <maxHistory>30</maxHistory>
            <totalSizeCap>3GB</totalSizeCap>
        </rollingPolicy>
    </appender>

    <root level="INFO">
        <appender-ref ref="Console"/>
        <appender-ref ref="File"/>
    </root>

    <logger name="com.example.myapp" level="DEBUG" additivity="false">
        <appender-ref ref="Console"/>
        <appender-ref ref="File"/>
    </logger>
</configuration>
```

### 3. Logging Service

```java
@Service
@Slf4j
public class LoggingService {
    private final ObjectMapper objectMapper;

    public LoggingService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void logEvent(String event, Object data) {
        try {
            MDC.put("event", event);
            String jsonData = objectMapper.writeValueAsString(data);
            log.info("Event: {} - Data: {}", event, jsonData);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event data", e);
        } finally {
            MDC.remove("event");
        }
    }

    public void logMetric(String metric, double value, Map<String, String> tags) {
        try {
            MDC.put("metric", metric);
            MDC.put("value", String.valueOf(value));
            tags.forEach(MDC::put);
            log.info("Metric: {} - Value: {} - Tags: {}", metric, value, tags);
        } finally {
            MDC.remove("metric");
            MDC.remove("value");
            tags.keySet().forEach(MDC::remove);
        }
    }

    public void logAudit(String action, String userId, String resource) {
        MDC.put("userId", userId);
        MDC.put("action", action);
        MDC.put("resource", resource);
        log.info("Audit: User {} performed {} on {}", userId, action, resource);
        MDC.clear();
    }
}
```

## Real-World Examples

### 1. Request Logging Filter

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class RequestLoggingFilter extends OncePerRequestFilter {
    private final ObjectMapper objectMapper;

    public RequestLoggingFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain)
            throws ServletException, IOException {

        if (request.getRequestURI().contains("/actuator")) {
            filterChain.doFilter(request, response);
            return;
        }

        String traceId = UUID.randomUUID().toString();
        MDC.put("traceId", traceId);
        response.setHeader("X-Trace-ID", traceId);

        long startTime = System.currentTimeMillis();

        try {
            logRequest(request);
            filterChain.doFilter(request, response);
        } finally {
            logResponse(response, System.currentTimeMillis() - startTime);
            MDC.clear();
        }
    }

    private void logRequest(HttpServletRequest request) {
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("method", request.getMethod());
        requestData.put("uri", request.getRequestURI());
        requestData.put("query", request.getQueryString());
        requestData.put("client_ip", request.getRemoteAddr());
        requestData.put("user_agent", request.getHeader("User-Agent"));

        try {
            log.info("Incoming request: {}", objectMapper.writeValueAsString(requestData));
        } catch (JsonProcessingException e) {
            log.error("Failed to log request", e);
        }
    }

    private void logResponse(HttpServletResponse response, long duration) {
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("status", response.getStatus());
        responseData.put("duration_ms", duration);

        try {
            log.info("Outgoing response: {}", objectMapper.writeValueAsString(responseData));
        } catch (JsonProcessingException e) {
            log.error("Failed to log response", e);
        }
    }
}
```

### 2. Performance Logging Aspect

```java
@Aspect
@Component
@Slf4j
public class PerformanceLoggingAspect {
    private final MeterRegistry meterRegistry;

    public PerformanceLoggingAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Around("@annotation(LogPerformance)")
    public Object logMethodPerformance(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String fullMethodName = className + "." + methodName;

        Timer.Sample sample = Timer.start(meterRegistry);

        try {
            return joinPoint.proceed();
        } catch (Throwable throwable) {
            log.error("Error executing {}: {}", fullMethodName, throwable.getMessage());
            throw throwable;
        } finally {
            long duration = sample.stop(Timer.builder("method.execution")
                .tag("class", className)
                .tag("method", methodName)
                .register(meterRegistry));

            log.info("Method {} executed in {} ms", fullMethodName, duration);
        }
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogPerformance {
}
```

### 3. Error Logging Service

```java
@Service
@Slf4j
public class ErrorLoggingService {
    private final SlackNotificationService slackNotificationService;
    private final ObjectMapper objectMapper;

    public ErrorLoggingService(SlackNotificationService slackNotificationService,
                             ObjectMapper objectMapper) {
        this.slackNotificationService = slackNotificationService;
        this.objectMapper = objectMapper;
    }

    public void logError(Throwable error, String context, Map<String, Object> metadata) {
        String errorId = UUID.randomUUID().toString();
        MDC.put("errorId", errorId);
        MDC.put("context", context);

        try {
            Map<String, Object> errorDetails = new HashMap<>();
            errorDetails.put("error_id", errorId);
            errorDetails.put("error_type", error.getClass().getName());
            errorDetails.put("error_message", error.getMessage());
            errorDetails.put("context", context);
            errorDetails.put("metadata", metadata);
            errorDetails.put("stack_trace", Arrays.toString(error.getStackTrace()));

            String errorJson = objectMapper.writeValueAsString(errorDetails);
            log.error("Application error: {}", errorJson, error);

            if (isCriticalError(error)) {
                notifyCriticalError(errorDetails);
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to process error details", e);
        } finally {
            MDC.remove("errorId");
            MDC.remove("context");
        }
    }

    private boolean isCriticalError(Throwable error) {
        return error instanceof OutOfMemoryError ||
               error instanceof ThreadDeath ||
               error instanceof StackOverflowError ||
               error instanceof DataCorruptionException;
    }

    private void notifyCriticalError(Map<String, Object> errorDetails) {
        try {
            slackNotificationService.sendCriticalErrorAlert(errorDetails);
        } catch (Exception e) {
            log.error("Failed to send critical error notification", e);
        }
    }
}
```

## Common Pitfalls

1. ❌ Logging sensitive information
   ✅ Implement proper data masking

2. ❌ Excessive logging
   ✅ Use appropriate log levels

3. ❌ Missing contextual information
   ✅ Include relevant context in logs

4. ❌ Inconsistent log formats
   ✅ Standardize log patterns

## Best Practices

1. Use appropriate log levels (ERROR, WARN, INFO, DEBUG, TRACE)
2. Include contextual information
3. Implement structured logging
4. Configure log rotation
5. Use MDC for request tracking
6. Implement proper error logging
7. Monitor log storage
8. Regular log analysis

## Knowledge Check

- [ ] Configure logging levels
- [ ] Implement request logging
- [ ] Set up log rotation
- [ ] Use MDC for tracking
- [ ] Implement performance logging
- [ ] Configure error logging

## Additional Resources

- [Spring Boot Logging Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.logging)
- [Logback Documentation](http://logback.qos.ch/documentation.html)
- [SLF4J Documentation](http://www.slf4j.org/manual.html)
- [ELK Stack Documentation](https://www.elastic.co/guide/index.html)

---

⬅️ Previous: [Testing](./17-testing.md)

➡️ Next: [Caching](./19-caching.md)