# Spring Boot Validation ✅

## Overview

Master validation in Spring Boot applications. Learn about built-in validators, custom validation constraints, validation groups, and cross-field validation.

## Core Concepts

### 1. Basic Validation

```java
@Data
@Builder
public class UserDTO {
    @NotNull(message = "Username is required")
    @Size(min = 4, max = 50, message = "Username must be between 4 and 50 characters")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotNull(message = "Password is required")
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=])(?=\\S+$).{8,}$",
        message = "Password must be 8+ characters with digits, upper/lowercase letters, and special chars"
    )
    private String password;

    @Min(value = 18, message = "Age must be at least 18")
    @Max(value = 100, message = "Age must be less than 100")
    private int age;

    @Past(message = "Birth date must be in the past")
    private LocalDate birthDate;

    @Future(message = "Subscription expiry must be in the future")
    private LocalDateTime subscriptionExpiry;
}
```

### 2. Custom Validators

```java
@Documented
@Constraint(validatedBy = PasswordStrengthValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordStrength {
    String message() default "Password is too weak";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    int minLength() default 8;
    boolean requiresDigit() default true;
    boolean requiresLowercase() default true;
    boolean requiresUppercase() default true;
    boolean requiresSpecialChar() default true;
}

public class PasswordStrengthValidator implements ConstraintValidator<PasswordStrength, String> {
    private int minLength;
    private boolean requiresDigit;
    private boolean requiresLowercase;
    private boolean requiresUppercase;
    private boolean requiresSpecialChar;

    @Override
    public void initialize(PasswordStrength constraintAnnotation) {
        this.minLength = constraintAnnotation.minLength();
        this.requiresDigit = constraintAnnotation.requiresDigit();
        this.requiresLowercase = constraintAnnotation.requiresLowercase();
        this.requiresUppercase = constraintAnnotation.requiresUppercase();
        this.requiresSpecialChar = constraintAnnotation.requiresSpecialChar();
    }

    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        if (password == null) {
            return false;
        }

        boolean isValid = password.length() >= minLength;

        if (requiresDigit) {
            isValid &= password.matches(".*\\d.*");
        }
        if (requiresLowercase) {
            isValid &= password.matches(".*[a-z].*");
        }
        if (requiresUppercase) {
            isValid &= password.matches(".*[A-Z].*");
        }
        if (requiresSpecialChar) {
            isValid &= password.matches(".*[@#$%^&+=].*");
        }

        if (!isValid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Password must meet complexity requirements")
                .addConstraintViolation();
        }

        return isValid;
    }
}
```

### 3. Cross-Field Validation

```java
@Documented
@Constraint(validatedBy = PasswordMatchValidator.class)
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordMatch {
    String message() default "Passwords must match";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class PasswordMatchValidator implements ConstraintValidator<PasswordMatch, PasswordResetDTO> {
    @Override
    public boolean isValid(PasswordResetDTO dto, ConstraintValidatorContext context) {
        if (dto.getPassword() == null || dto.getConfirmPassword() == null) {
            return false;
        }

        if (!dto.getPassword().equals(dto.getConfirmPassword())) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Passwords do not match")
                .addPropertyNode("confirmPassword")
                .addConstraintViolation();
            return false;
        }

        return true;
    }
}

@Data
@PasswordMatch
public class PasswordResetDTO {
    @NotNull
    @PasswordStrength
    private String password;

    @NotNull
    private String confirmPassword;
}
```

## Real-World Examples

### 1. Advanced Request Validation

```java
@RestController
@RequestMapping("/api/v1/orders")
@Validated
public class OrderController {
    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(
            @Valid @RequestBody OrderCreateRequest request,
            @Validated(OrderValidation.Create.class) OrderValidator validator) {
        validator.validateBusinessRules(request);
        // Process order
        return ResponseEntity.ok(orderService.createOrder(request));
    }
}

@Component
public class OrderValidator {
    private final ProductService productService;
    private final InventoryService inventoryService;

    @Validated(OrderValidation.Create.class)
    public void validateBusinessRules(OrderCreateRequest request) {
        // Validate product availability
        request.getItems().forEach(item -> {
            Product product = productService.getProduct(item.getProductId());
            if (!inventoryService.isAvailable(product.getId(), item.getQuantity())) {
                throw new ValidationException(
                    String.format("Insufficient stock for product %s", product.getId()));
            }
        });

        // Validate total amount
        BigDecimal total = calculateTotal(request.getItems());
        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Order total must be greater than zero");
        }
    }
}
```

### 2. Validation Groups

```java
public interface ValidationGroups {
    interface Create {}
    interface Update {}
    interface Delete {}
}

@Data
public class ProductDTO {
    @Null(groups = ValidationGroups.Create.class)
    @NotNull(groups = ValidationGroups.Update.class)
    private Long id;

    @NotBlank(groups = {ValidationGroups.Create.class, ValidationGroups.Update.class})
    @Size(min = 3, max = 100)
    private String name;

    @NotNull(groups = {ValidationGroups.Create.class, ValidationGroups.Update.class})
    @Positive
    private BigDecimal price;

    @Min(0)
    private Integer stock;

    @Future(groups = ValidationGroups.Create.class)
    private LocalDateTime availableFrom;
}

@RestController
@RequestMapping("/api/v1/products")
@Validated
public class ProductController {
    @PostMapping
    public ResponseEntity<ProductDTO> createProduct(
            @Validated(ValidationGroups.Create.class) @RequestBody ProductDTO product) {
        return ResponseEntity.ok(productService.createProduct(product));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductDTO> updateProduct(
            @PathVariable Long id,
            @Validated(ValidationGroups.Update.class) @RequestBody ProductDTO product) {
        return ResponseEntity.ok(productService.updateProduct(id, product));
    }
}
```

### 3. Validation Error Handling

```java
@ControllerAdvice
public class ValidationExceptionHandler extends ResponseEntityExceptionHandler {
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatus status,
            WebRequest request) {

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());

        // Get all validation errors
        List<String> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error ->
                String.format("%s: %s", error.getField(), error.getDefaultMessage()))
            .collect(Collectors.toList());

        body.put("errors", errors);

        return new ResponseEntity<>(body, headers, status);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Object> handleConstraintViolation(
            ConstraintViolationException ex) {

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", HttpStatus.BAD_REQUEST.value());

        // Get all constraint violations
        List<String> errors = ex.getConstraintViolations()
            .stream()
            .map(violation ->
                String.format("%s: %s",
                    violation.getPropertyPath(),
                    violation.getMessage()))
            .collect(Collectors.toList());

        body.put("errors", errors);

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }
}
```

## Common Pitfalls

1. ❌ Not using @Valid or @Validated
   ✅ Always use validation annotations

2. ❌ Mixing validation logic
   ✅ Separate validation concerns

3. ❌ Ignoring validation groups
   ✅ Use validation groups for different contexts

4. ❌ Poor error messages
   ✅ Provide clear, actionable messages

## Best Practices

1. Use appropriate constraints
2. Implement custom validators
3. Group validations logically
4. Handle validation errors properly
5. Validate at service layer
6. Use meaningful messages
7. Test validation rules
8. Document constraints

## Knowledge Check

- [ ] Configure basic validation
- [ ] Create custom validators
- [ ] Implement cross-field validation
- [ ] Use validation groups
- [ ] Handle validation errors
- [ ] Test validation rules

## Additional Resources

- [Bean Validation Specification](https://beanvalidation.org/2.0/spec/)
- [Spring Validation Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#validation)
- [Hibernate Validator](https://hibernate.org/validator/)
- [Jakarta Bean Validation](https://jakarta.ee/specifications/bean-validation/)

---

⬅️ Previous: [Async](./24-async.md)

➡️ Next: [Security](./26-security.md)