# Validation in Spring Boot 🛡️

## Overview

Master data validation in Spring Boot applications. Learn about Bean Validation, custom validators, validation groups, and cross-field validation.

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
        message = "Password must be at least 8 characters long and contain at least one digit, " +
                 "one lowercase, one uppercase letter, and one special character"
    )
    private String password;

    @Past(message = "Birth date must be in the past")
    private LocalDate birthDate;

    @Min(value = 0, message = "Age must be positive")
    @Max(value = 150, message = "Age must be realistic")
    private int age;
}

@RestController
@RequestMapping("/api/users")
@Validated
public class UserController {
    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserDTO> createUser(
        @Valid @RequestBody UserDTO userDTO
    ) {
        return ResponseEntity.ok(userService.createUser(userDTO));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDTO> updateUser(
        @PathVariable Long id,
        @Valid @RequestBody UserDTO userDTO
    ) {
        return ResponseEntity.ok(userService.updateUser(id, userDTO));
    }
}
```

### 2. Custom Validators

```java
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = UniqueUsernameValidator.class)
public @interface UniqueUsername {
    String message() default "Username already exists";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

@Component
public class UniqueUsernameValidator implements ConstraintValidator<UniqueUsername, String> {
    private final UserRepository userRepository;

    @Override
    public boolean isValid(String username, ConstraintValidatorContext context) {
        if (username == null) {
            return true; // Let @NotNull handle null values
        }
        return !userRepository.existsByUsername(username);
    }
}

@Data
public class ProductDTO {
    @NotNull
    private String name;

    @NotNull
    @Positive
    private BigDecimal price;

    @Future
    private LocalDate releaseDate;

    @UniqueUsername
    private String createdBy;
}
```

### 3. Validation Groups

```java
public interface OnCreate {}
public interface OnUpdate {}

@Data
public class CustomerDTO {
    @Null(groups = OnCreate.class)
    @NotNull(groups = OnUpdate.class)
    private Long id;

    @NotBlank(groups = {OnCreate.class, OnUpdate.class})
    private String name;

    @NotBlank(groups = OnCreate.class)
    @Email(groups = {OnCreate.class, OnUpdate.class})
    private String email;

    @NotNull(groups = OnCreate.class)
    private String password;
}

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    @PostMapping
    public ResponseEntity<CustomerDTO> createCustomer(
        @Validated(OnCreate.class) @RequestBody CustomerDTO customerDTO
    ) {
        return ResponseEntity.ok(customerService.createCustomer(customerDTO));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomerDTO> updateCustomer(
        @PathVariable Long id,
        @Validated(OnUpdate.class) @RequestBody CustomerDTO customerDTO
    ) {
        return ResponseEntity.ok(customerService.updateCustomer(id, customerDTO));
    }
}
```

## Real-World Examples

### 1. Cross-Field Validation

```java
@Data
@PasswordMatch(message = "Password and confirmation must match")
public class RegistrationDTO {
    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Pattern(regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}$")
    private String password;

    @NotBlank
    private String confirmPassword;
}

@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PasswordMatchValidator.class)
public @interface PasswordMatch {
    String message() default "Passwords don't match";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class PasswordMatchValidator implements ConstraintValidator<PasswordMatch, RegistrationDTO> {
    @Override
    public boolean isValid(RegistrationDTO dto, ConstraintValidatorContext context) {
        if (dto.getPassword() == null || dto.getConfirmPassword() == null) {
            return true; // Let @NotBlank handle null values
        }
        return dto.getPassword().equals(dto.getConfirmPassword());
    }
}
```

### 2. Advanced Validation Service

```java
@Service
@Slf4j
public class ValidationService {
    private final Validator validator;

    public <T> ValidationResult validate(T object, Class<?>... groups) {
        Set<ConstraintViolation<T>> violations = validator.validate(object, groups);

        if (violations.isEmpty()) {
            return ValidationResult.builder()
                .valid(true)
                .build();
        }

        Map<String, List<String>> fieldErrors = violations.stream()
            .collect(Collectors.groupingBy(
                violation -> violation.getPropertyPath().toString(),
                Collectors.mapping(
                    ConstraintViolation::getMessage,
                    Collectors.toList()
                )
            ));

        return ValidationResult.builder()
            .valid(false)
            .fieldErrors(fieldErrors)
            .build();
    }

    public <T> void validateAndThrow(T object, Class<?>... groups) {
        ValidationResult result = validate(object, groups);
        if (!result.isValid()) {
            throw new ValidationException("Validation failed", result.getFieldErrors());
        }
    }

    public <T> void validateProperty(T object, String propertyName) {
        Set<ConstraintViolation<T>> violations = validator.validateProperty(
            object,
            propertyName
        );

        if (!violations.isEmpty()) {
            Map<String, List<String>> fieldErrors = Map.of(
                propertyName,
                violations.stream()
                    .map(ConstraintViolation::getMessage)
                    .collect(Collectors.toList())
            );
            throw new ValidationException(
                "Property validation failed",
                fieldErrors
            );
        }
    }
}
```

### 3. Validation Aspect

```java
@Aspect
@Component
@Slf4j
public class ValidationAspect {
    private final ValidationService validationService;

    @Before("@annotation(Validate)")
    public void validateMethod(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();

        Validate validateAnnotation = method.getAnnotation(Validate.class);
        Class<?>[] groups = validateAnnotation.groups();

        Object[] args = joinPoint.getArgs();
        Parameter[] parameters = method.getParameters();

        for (int i = 0; i < parameters.length; i++) {
            if (parameters[i].isAnnotationPresent(Valid.class)) {
                validationService.validateAndThrow(args[i], groups);
            }
        }
    }

    @AfterThrowing(
        pointcut = "@annotation(Validate)",
        throwing = "ex"
    )
    public void handleValidationError(JoinPoint joinPoint, ValidationException ex) {
        log.error("Validation failed for method {}: {}",
            joinPoint.getSignature().getName(),
            ex.getMessage()
        );
        throw ex;
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Validate {
    Class<?>[] groups() default {};
}
```

## Common Pitfalls

1. ❌ Not handling validation errors properly
   ✅ Implement global exception handling

2. ❌ Over-validating
   ✅ Use validation groups for different contexts

3. ❌ Missing cross-field validation
   ✅ Implement class-level constraints

4. ❌ Inconsistent validation messages
   ✅ Use message externalization

## Best Practices

1. Use validation groups for different contexts
2. Implement custom validators for complex rules
3. Centralize validation logic
4. Use proper error responses
5. Validate at the appropriate layer
6. Use message externalization
7. Implement cross-field validation
8. Add validation documentation

## Knowledge Check

- [ ] Implement basic validation
- [ ] Create custom validator
- [ ] Use validation groups
- [ ] Handle validation errors
- [ ] Implement cross-field validation
- [ ] Add validation documentation

## Additional Resources

- [Bean Validation Specification](https://beanvalidation.org/2.0/spec/)
- [Spring Validation Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#validation)
- [Hibernate Validator](https://hibernate.org/validator/)
- [Jakarta Bean Validation](https://jakarta.ee/specifications/bean-validation/)

---

⬅️ Previous: [Scheduling](./14-scheduling.md)

➡️ Next: [Documentation](./16-documentation.md)