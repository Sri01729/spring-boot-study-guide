# API Documentation in Spring Boot 📚

## Overview

Master API documentation in Spring Boot applications using OpenAPI 3.0 (formerly Swagger). Learn about automated documentation generation, customization, and best practices for maintaining clear API documentation.

## Core Concepts

### 1. OpenAPI Configuration

```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
```

```properties
# application.properties
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.operationsSorter=method
springdoc.swagger-ui.tagsSorter=alpha
springdoc.swagger-ui.tryItOutEnabled=true
springdoc.swagger-ui.filter=true
springdoc.packages-to-scan=com.example.controller
springdoc.paths-to-match=/api/**
```

### 2. OpenAPI Configuration Class

```java
@Configuration
public class OpenAPIConfig {
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("My API Documentation")
                .version("1.0")
                .description("API documentation using OpenAPI 3.0")
                .termsOfService("http://example.com/terms/")
                .license(new License()
                    .name("Apache 2.0")
                    .url("http://springdoc.org"))
                .contact(new Contact()
                    .name("John Doe")
                    .email("john@example.com")
                    .url("http://example.com")))
            .externalDocs(new ExternalDocumentation()
                .description("Wiki Documentation")
                .url("https://wiki.example.com"))
            .servers(Arrays.asList(
                new Server()
                    .url("http://dev.example.com")
                    .description("Development server"),
                new Server()
                    .url("http://prod.example.com")
                    .description("Production server")));
    }

    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
            .group("public")
            .pathsToMatch("/api/public/**")
            .build();
    }

    @Bean
    public GroupedOpenApi adminApi() {
        return GroupedOpenApi.builder()
            .group("admin")
            .pathsToMatch("/api/admin/**")
            .addOpenApiMethodFilter(method -> method.isAnnotationPresent(Admin.class))
            .build();
    }
}
```

### 3. Security Schema Configuration

```java
@Configuration
public class OpenAPISecurityConfig {
    @Bean
    public SecurityScheme securityScheme() {
        return new SecurityScheme()
            .type(SecurityScheme.Type.HTTP)
            .scheme("bearer")
            .bearerFormat("JWT")
            .in(SecurityScheme.In.HEADER)
            .name("Authorization");
    }

    @Bean
    public OpenAPI securityOpenAPI() {
        return new OpenAPI()
            .addSecurityItem(new SecurityRequirement()
                .addList("bearerAuth"))
            .components(new Components()
                .addSecuritySchemes("bearerAuth", securityScheme()));
    }
}
```

## Real-World Examples

### 1. Documented REST Controller

```java
@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User Management", description = "APIs for managing users")
public class UserController {

    @Operation(
        summary = "Create a new user",
        description = "Creates a new user with the provided information"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "201",
            description = "User created successfully",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = UserDTO.class)
            )
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid input",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = ErrorResponse.class)
            )
        )
    })
    @PostMapping
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<UserDTO> createUser(
        @Parameter(description = "User creation request")
        @Valid @RequestBody UserCreateDTO request
    ) {
        // Implementation
    }

    @Operation(
        summary = "Get user by ID",
        description = "Retrieves a user by their unique identifier"
    )
    @Parameter(
        name = "id",
        description = "User's unique identifier",
        required = true,
        example = "123"
    )
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUser(@PathVariable Long id) {
        // Implementation
    }
}
```

### 2. Complex Request/Response Documentation

```java
@Schema(description = "Order creation request")
public class OrderCreateDTO {
    @Schema(description = "Customer ID", example = "12345")
    private Long customerId;

    @Schema(description = "List of items in the order")
    private List<OrderItemDTO> items;

    @Schema(description = "Shipping address details")
    private AddressDTO shippingAddress;

    @Schema(description = "Preferred delivery date", example = "2024-12-25")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate deliveryDate;
}

@Schema(description = "Order response")
public class OrderResponseDTO {
    @Schema(description = "Order unique identifier", example = "ORD-2024-001")
    private String orderNumber;

    @Schema(description = "Order status", example = "PROCESSING")
    private OrderStatus status;

    @Schema(description = "Total order amount", example = "299.99")
    private BigDecimal totalAmount;

    @Schema(description = "Estimated delivery date", example = "2024-12-25")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate estimatedDelivery;
}

@RestController
@RequestMapping("/api/v1/orders")
@Tag(name = "Order Management", description = "APIs for managing orders")
public class OrderController {
    @Operation(
        summary = "Create new order",
        description = "Creates a new order with the provided items and shipping details"
    )
    @PostMapping
    public ResponseEntity<OrderResponseDTO> createOrder(
        @RequestBody @Valid OrderCreateDTO request,
        @Parameter(hidden = true) @CurrentUser UserDetails user
    ) {
        // Implementation
    }
}
```

### 3. Custom Documentation Extensions

```java
@Configuration
public class CustomOpenAPIExtension {
    @Bean
    public OpenApiCustomizer customOpenApiCustomizer() {
        return openApi -> {
            // Add custom server variables
            openApi.getServers().forEach(server -> {
                server.addVariablesItem("version", new ServerVariable()
                    ._default("v1")
                    .description("API Version")
                    .addEnumItem("v1")
                    .addEnumItem("v2"));
            });

            // Add custom schemas
            openApi.getComponents().addSchemas("ErrorResponse", new Schema<>()
                .type("object")
                .addProperties("code", new Schema<>().type("string"))
                .addProperties("message", new Schema<>().type("string"))
                .addProperties("details", new Schema<>().type("array")
                    .items(new Schema<>().type("string"))));
        };
    }

    @Bean
    public OperationCustomizer customOperationCustomizer() {
        return (operation, handlerMethod) -> {
            // Add custom operation metadata
            operation.addExtension("x-rate-limit", 100);
            operation.addExtension("x-requires-auth",
                handlerMethod.hasMethodAnnotation(Secured.class));

            // Add default responses
            operation.getResponses()
                .addApiResponse("429", new ApiResponse()
                    .description("Too Many Requests")
                    .content(new Content()
                        .addMediaType("application/json", new MediaType()
                            .schema(new Schema<>().$ref("ErrorResponse")))));

            return operation;
        };
    }
}
```

## Common Pitfalls

1. ❌ Exposing sensitive information in documentation
   ✅ Use proper security schemas and hide sensitive fields

2. ❌ Outdated documentation
   ✅ Keep documentation in sync with code

3. ❌ Incomplete response documentation
   ✅ Document all possible responses and status codes

4. ❌ Missing authentication details
   ✅ Configure security schemes properly

## Best Practices

1. Document all endpoints comprehensively
2. Use meaningful descriptions and examples
3. Include authentication requirements
4. Document error responses
5. Group related endpoints
6. Version your API documentation
7. Include request/response examples
8. Maintain documentation accuracy

## Knowledge Check

- [ ] Configure OpenAPI in a project
- [ ] Document REST endpoints
- [ ] Set up security schemas
- [ ] Create custom documentation extensions
- [ ] Group API endpoints
- [ ] Document request/response models

## Additional Resources

- [SpringDoc OpenAPI Documentation](https://springdoc.org/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Spring REST Docs](https://spring.io/projects/spring-restdocs)

---

⬅️ Previous: [DevTools](./16-devtools.md)

➡️ Next: [Actuator](./18-actuator.md)