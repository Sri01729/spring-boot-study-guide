# Error Handling in Spring Boot 🚨

## Overview

Master error handling in Spring Boot applications. Learn global exception handling, custom exceptions, error responses, validation errors, and best practices.

## Core Concepts

### Global Exception Handler
```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(
        ResourceNotFoundException ex,
        WebRequest request
    ) {
        ErrorResponse error = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.NOT_FOUND.value())
            .error("Not Found")
            .message(ex.getMessage())
            .path(((ServletWebRequest) request).getRequest().getRequestURI())
            .build();

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
        ValidationException ex,
        WebRequest request
    ) {
        ErrorResponse error = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.BAD_REQUEST.value())
            .error("Validation Error")
            .message(ex.getMessage())
            .path(((ServletWebRequest) request).getRequest().getRequestURI())
            .build();

        return ResponseEntity.badRequest().body(error);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
        MethodArgumentNotValidException ex,
        HttpHeaders headers,
        HttpStatusCode status,
        WebRequest request
    ) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
            errors.put(error.getField(), error.getDefaultMessage())
        );

        ValidationErrorResponse errorResponse = ValidationErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.BAD_REQUEST.value())
            .error("Validation Failed")
            .errors(errors)
            .path(((ServletWebRequest) request).getRequest().getRequestURI())
            .build();

        return ResponseEntity.badRequest().body(errorResponse);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAllUncaughtException(
        Exception ex,
        WebRequest request
    ) {
        log.error("Uncaught error occurred", ex);

        ErrorResponse error = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
            .error("Internal Server Error")
            .message("An unexpected error occurred")
            .path(((ServletWebRequest) request).getRequest().getRequestURI())
            .build();

        return ResponseEntity.internalServerError().body(error);
    }
}
```

### Custom Exceptions
```java
@Getter
public class ResourceNotFoundException extends RuntimeException {
    private final String resourceName;
    private final String fieldName;
    private final Object fieldValue;

    public ResourceNotFoundException(
        String resourceName,
        String fieldName,
        Object fieldValue
    ) {
        super(String.format(
            "%s not found with %s: '%s'",
            resourceName,
            fieldName,
            fieldValue
        ));
        this.resourceName = resourceName;
        this.fieldName = fieldName;
        this.fieldValue = fieldValue;
    }
}

@Getter
public class BusinessException extends RuntimeException {
    private final String code;
    private final Map<String, Object> params;

    public BusinessException(String message, String code) {
        this(message, code, Collections.emptyMap());
    }

    public BusinessException(
        String message,
        String code,
        Map<String, Object> params
    ) {
        super(message);
        this.code = code;
        this.params = params;
    }
}
```

## Real-World Examples

### 1. Advanced Error Response Models

```java
@Data
@Builder
public class ErrorResponse {
    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String message;
    private String path;
    private String traceId;
    private Map<String, Object> metadata;
}

@Data
@Builder
public class ValidationErrorResponse {
    private LocalDateTime timestamp;
    private int status;
    private String error;
    private Map<String, String> errors;
    private String path;
}

@Data
@Builder
public class BusinessErrorResponse {
    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String message;
    private String code;
    private Map<String, Object> params;
    private String path;
}
```

### 2. Domain-Specific Exception Handlers

```java
@RestControllerAdvice(basePackages = "com.example.order")
@Slf4j
public class OrderExceptionHandler {

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<BusinessErrorResponse> handleInsufficientStock(
        InsufficientStockException ex,
        WebRequest request
    ) {
        log.warn("Insufficient stock for product: {}", ex.getProductId());

        BusinessErrorResponse error = BusinessErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.CONFLICT.value())
            .error("Business Rule Violation")
            .message(ex.getMessage())
            .code("ORDER.INSUFFICIENT_STOCK")
            .params(Map.of(
                "productId", ex.getProductId(),
                "requested", ex.getRequestedQuantity(),
                "available", ex.getAvailableQuantity()
            ))
            .path(((ServletWebRequest) request).getRequest().getRequestURI())
            .build();

        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(PaymentFailedException.class)
    public ResponseEntity<BusinessErrorResponse> handlePaymentFailed(
        PaymentFailedException ex,
        WebRequest request
    ) {
        log.error("Payment failed for order: {}", ex.getOrderId(), ex);

        BusinessErrorResponse error = BusinessErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.BAD_GATEWAY.value())
            .error("Payment Processing Error")
            .message(ex.getMessage())
            .code("ORDER.PAYMENT_FAILED")
            .params(Map.of(
                "orderId", ex.getOrderId(),
                "reason", ex.getReason()
            ))
            .path(((ServletWebRequest) request).getRequest().getRequestURI())
            .build();

        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
    }
}
```

### 3. Validation with Custom Constraints

```java
@Documented
@Constraint(validatedBy = OrderItemsValidator.class)
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidOrderItems {
    String message() default "Invalid order items";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

@Component
public class OrderItemsValidator implements ConstraintValidator<ValidOrderItems, OrderRequest> {
    private final ProductService productService;

    public OrderItemsValidator(ProductService productService) {
        this.productService = productService;
    }

    @Override
    public boolean isValid(
        OrderRequest request,
        ConstraintValidatorContext context
    ) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Order must contain at least one item"
            ).addConstraintViolation();
            return false;
        }

        boolean isValid = true;
        context.disableDefaultConstraintViolation();

        for (OrderItemRequest item : request.getItems()) {
            if (item.getQuantity() <= 0) {
                context.buildConstraintViolationWithTemplate(
                    "Quantity must be greater than 0"
                )
                .addPropertyNode("items")
                .addConstraintViolation();
                isValid = false;
            }

            try {
                Product product = productService.getProduct(item.getProductId());
                if (!product.isActive()) {
                    context.buildConstraintViolationWithTemplate(
                        "Product is not available: " + item.getProductId()
                    )
                    .addPropertyNode("items")
                    .addConstraintViolation();
                    isValid = false;
                }
            } catch (ResourceNotFoundException e) {
                context.buildConstraintViolationWithTemplate(
                    "Invalid product: " + item.getProductId()
                )
                .addPropertyNode("items")
                .addConstraintViolation();
                isValid = false;
            }
        }

        return isValid;
    }
}
```

### 4. Error Monitoring and Logging

```java
@Aspect
@Component
@Slf4j
public class ErrorMonitoringAspect {
    private final ErrorReportingService errorReportingService;
    private final ObjectMapper objectMapper;

    public ErrorMonitoringAspect(
        ErrorReportingService errorReportingService,
        ObjectMapper objectMapper
    ) {
        this.errorReportingService = errorReportingService;
        this.objectMapper = objectMapper;
    }

    @AfterThrowing(
        pointcut = "within(@org.springframework.web.bind.annotation.RestController *)",
        throwing = "ex"
    )
    public void logControllerError(JoinPoint joinPoint, Exception ex) {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getName();
        Object[] args = joinPoint.getArgs();

        Map<String, Object> errorContext = new HashMap<>();
        errorContext.put("class", className);
        errorContext.put("method", methodName);
        errorContext.put("timestamp", LocalDateTime.now());

        try {
            errorContext.put("arguments", objectMapper.writeValueAsString(args));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize method arguments", e);
        }

        MDC.put("errorId", UUID.randomUUID().toString());
        MDC.put("className", className);
        MDC.put("methodName", methodName);

        log.error(
            "Error in controller method: {} - {}",
            methodName,
            ex.getMessage(),
            ex
        );

        errorReportingService.reportError(ex, errorContext);

        MDC.clear();
    }
}

@Service
@Slf4j
public class ErrorReportingService {
    private final MetricRegistry metricRegistry;
    private final SlackNotifier slackNotifier;
    private final ErrorRepository errorRepository;

    public void reportError(Throwable error, Map<String, Object> context) {
        // Increment error metrics
        String errorMetricName = "errors." +
            error.getClass().getSimpleName().toLowerCase();
        metricRegistry.counter(errorMetricName).increment();

        // Log to database
        ErrorLog errorLog = ErrorLog.builder()
            .timestamp(LocalDateTime.now())
            .errorClass(error.getClass().getName())
            .message(error.getMessage())
            .stackTrace(getStackTrace(error))
            .context(context)
            .build();

        errorRepository.save(errorLog);

        // Notify if severe
        if (isSevereError(error)) {
            slackNotifier.notifyError(error, context);
        }
    }

    private boolean isSevereError(Throwable error) {
        return !(error instanceof BusinessException) &&
               !(error instanceof ValidationException) &&
               !(error instanceof ResourceNotFoundException);
    }

    private String getStackTrace(Throwable error) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        error.printStackTrace(pw);
        return sw.toString();
    }
}
```

## Common Pitfalls

1. ❌ Exposing sensitive information in errors
   ✅ Sanitize error messages

2. ❌ Not handling specific exceptions
   ✅ Create custom exceptions

3. ❌ Inconsistent error responses
   ✅ Use standardized error models

4. ❌ Missing error logging
   ✅ Implement proper logging

## Best Practices

1. Use global exception handlers
2. Create custom exceptions
3. Standardize error responses
4. Implement proper validation
5. Log errors appropriately
6. Monitor error patterns
7. Handle business exceptions
8. Secure error messages

## Knowledge Check

- [ ] Implement global exception handler
- [ ] Create custom exceptions
- [ ] Handle validation errors
- [ ] Set up error monitoring
- [ ] Use proper logging
- [ ] Secure error responses

## Additional Resources

- [Spring Boot Error Handling](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.developing-web-applications.spring-mvc.error-handling)
- [Exception Handling in REST APIs](https://www.baeldung.com/exception-handling-for-rest-with-spring)
- [Spring Validation](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#validation)
- [Logging Best Practices](https://www.slf4j.org/manual.html)

---

⬅️ Previous: [Spring Data JPA](./09-spring-data-jpa.md)

➡️ Next: [Deployment](./12-deployment.md)