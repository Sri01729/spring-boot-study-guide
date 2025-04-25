# Logging in Spring Boot 📝

## Overview

Master logging in Spring Boot applications. Learn about logging configuration, different logging frameworks, log patterns, and best practices for effective application logging.

## Core Concepts

### 1. Logging Configuration

```properties
# application.properties
logging.level.root=INFO
logging.level.org.springframework.web=DEBUG
logging.level.com.example=TRACE

# File logging
logging.file.name=logs/application.log
logging.file.max-size=10MB
logging.file.max-history=30

# Pattern configuration
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n
logging.pattern.file=%d{yyyy-MM-dd HH:mm:ss} [%X{correlationId}] [%thread] %-5level %logger{36} - %msg%n
```

```yaml
# application.yml
logging:
  level:
    root: INFO
    org.springframework.web: DEBUG
    com.example: TRACE
  file:
    name: logs/application.log
    max-size: 10MB
    max-history: 30
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
    file: "%d{yyyy-MM-dd HH:mm:ss} [%X{correlationId}] [%thread] %-5level %logger{36} - %msg%n"
```

### 2. Logback Configuration

```xml
<!-- logback-spring.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <include resource="org/springframework/boot/logging/logback/defaults.xml"/>

    <property name="LOG_FILE" value="logs/application.log"/>
    <property name="CONSOLE_LOG_PATTERN"
              value="%clr(%d{yyyy-MM-dd HH:mm:ss.SSS}){faint} %clr(%5p) %clr(${PID:- }){magenta} %clr(---){faint} %clr([%15.15t]){faint} %clr(%-40.40logger{39}){cyan} %clr(:){faint} %m%n%wEx"/>

    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${CONSOLE_LOG_PATTERN}</pattern>
            <charset>utf8</charset>
        </encoder>
    </appender>

    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_FILE}</file>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>${LOG_FILE}.%d{yyyy-MM-dd}.gz</fileNamePattern>
            <maxHistory>30</maxHistory>
            <totalSizeCap>3GB</totalSizeCap>
        </rollingPolicy>
    </appender>

    <appender name="ASYNC" class="ch.qos.logback.classic.AsyncAppender">
        <queueSize>512</queueSize>
        <appender-ref ref="FILE"/>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="ASYNC"/>
    </root>

    <logger name="com.example" level="DEBUG"/>
    <logger name="org.springframework.web" level="INFO"/>
</configuration>
```

### 3. Custom Log Configuration

```java
@Configuration
public class LoggingConfig {
    @Bean
    public LoggingAspect loggingAspect() {
        return new LoggingAspect();
    }
}

@Aspect
@Component
@Slf4j
public class LoggingAspect {
    @Around("@annotation(LogExecutionTime)")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        String methodName = joinPoint.getSignature().toShortString();

        try {
            log.info("Starting method: {}", methodName);
            Object result = joinPoint.proceed();
            long executionTime = System.currentTimeMillis() - start;
            log.info("Method: {} completed in {}ms", methodName, executionTime);
            return result;
        } catch (Exception e) {
            log.error("Method: {} failed with error: {}", methodName, e.getMessage());
            throw e;
        }
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogExecutionTime {
}
```

## Real-World Examples

### 1. Structured Logging Service

```java
@Service
@Slf4j
public class StructuredLoggingService {
    public void logBusinessEvent(String eventType, Object data) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("eventType", eventType);
        logData.put("timestamp", LocalDateTime.now());
        logData.put("data", data);

        log.info("Business event: {}", JsonUtils.toJson(logData));
    }

    public void logMetric(String metricName, double value, Map<String, String> tags) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("metric", metricName);
        logData.put("value", value);
        logData.put("tags", tags);
        logData.put("timestamp", System.currentTimeMillis());

        log.info("Metric: {}", JsonUtils.toJson(logData));
    }

    public void logAudit(String action, String userId, String resource) {
        Map<String, Object> logData = new HashMap<>();
        logData.put("type", "AUDIT");
        logData.put("action", action);
        logData.put("userId", userId);
        logData.put("resource", resource);
        logData.put("timestamp", LocalDateTime.now());
        logData.put("ipAddress", RequestContextHolder.currentRequestAttributes()
            .getRequest().getRemoteAddr());

        log.info("Audit: {}", JsonUtils.toJson(logData));
    }
}
```

### 2. Request/Response Logging Filter

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestResponseLoggingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(RequestResponseLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {
        MDC.put("correlationId", UUID.randomUUID().toString());

        try {
            logRequest(request);
            ContentCachingResponseWrapper responseWrapper =
                new ContentCachingResponseWrapper(response);
            ContentCachingRequestWrapper requestWrapper =
                new ContentCachingRequestWrapper(request);

            filterChain.doFilter(requestWrapper, responseWrapper);

            logResponse(responseWrapper);
            responseWrapper.copyBodyToResponse();
        } finally {
            MDC.remove("correlationId");
        }
    }

    private void logRequest(HttpServletRequest request) {
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("method", request.getMethod());
        requestData.put("uri", request.getRequestURI());
        requestData.put("queryString", request.getQueryString());
        requestData.put("headers", getHeaders(request));

        log.info("Incoming request: {}", JsonUtils.toJson(requestData));
    }

    private void logResponse(ContentCachingResponseWrapper response) {
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("status", response.getStatus());
        responseData.put("headers", response.getHeaderNames()
            .stream()
            .collect(Collectors.toMap(
                Function.identity(),
                response::getHeader)));

        log.info("Outgoing response: {}", JsonUtils.toJson(responseData));
    }
}
```

### 3. Error Logging Service

```java
@Service
@Slf4j
public class ErrorLoggingService {
    private final SlackNotificationService slackNotificationService;
    private final MetricsService metricsService;

    public void logError(Throwable error, String context) {
        String errorId = UUID.randomUUID().toString();
        MDC.put("errorId", errorId);

        try {
            Map<String, Object> errorDetails = new HashMap<>();
            errorDetails.put("errorId", errorId);
            errorDetails.put("timestamp", LocalDateTime.now());
            errorDetails.put("context", context);
            errorDetails.put("errorType", error.getClass().getName());
            errorDetails.put("errorMessage", error.getMessage());
            errorDetails.put("stackTrace", getStackTraceAsString(error));

            if (error instanceof BusinessException) {
                log.warn("Business error occurred: {}", JsonUtils.toJson(errorDetails));
            } else {
                log.error("System error occurred: {}", JsonUtils.toJson(errorDetails));
                notifyTeam(errorDetails);
            }

            metricsService.incrementErrorCount(error.getClass().getSimpleName());
        } finally {
            MDC.remove("errorId");
        }
    }

    private void notifyTeam(Map<String, Object> errorDetails) {
        if (isCriticalError(errorDetails)) {
            slackNotificationService.sendAlert(
                "Critical Error",
                formatErrorMessage(errorDetails)
            );
        }
    }
}
```

## Common Pitfalls

1. ❌ Logging sensitive information
   ✅ Implement proper data masking

2. ❌ Excessive logging
   ✅ Use appropriate log levels

3. ❌ Poor log message formatting
   ✅ Use structured logging

4. ❌ Missing context information
   ✅ Include relevant context in logs

## Best Practices

1. Use appropriate log levels
2. Implement structured logging
3. Include correlation IDs
4. Configure log rotation
5. Mask sensitive data
6. Use async logging for performance
7. Include relevant context
8. Implement proper error logging

## Knowledge Check

- [ ] Configure basic logging
- [ ] Set up file-based logging
- [ ] Implement structured logging
- [ ] Configure log rotation
- [ ] Implement request/response logging
- [ ] Set up error logging

## Additional Resources

- [Spring Boot Logging Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.logging)
- [Logback Documentation](http://logback.qos.ch/documentation.html)
- [SLF4J Documentation](http://www.slf4j.org/manual.html)
- [ELK Stack Documentation](https://www.elastic.co/guide/index.html)

---

⬅️ Previous: [Actuator](./20-actuator.md)

➡️ Next: [Profiles](./22-profiles.md)