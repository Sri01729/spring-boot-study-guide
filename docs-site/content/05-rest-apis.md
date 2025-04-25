# Building REST APIs with Spring Boot 🌐

## Overview

Learn how to build production-grade REST APIs using Spring Boot. This module covers REST principles, API design, implementation patterns, and best practices for scalable web services.

## Core Concepts

### REST Principles
- Resource-based URLs
- HTTP methods as actions
- Stateless communication
- HATEOAS (Hypermedia)
- Content negotiation

### HTTP Status Codes
```java
200 OK              // Success
201 Created         // Resource created
204 No Content      // Success, no response body
400 Bad Request     // Invalid request
401 Unauthorized    // Authentication required
403 Forbidden       // Insufficient permissions
404 Not Found       // Resource not found
500 Server Error    // Internal error
```

## Real-World Example: Product API

### 1. Data Model

```java
@Data
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(min = 3, max = 100)
    private String name;

    @NotNull
    @Positive
    private BigDecimal price;

    @Min(0)
    private Integer stockQuantity;

    @Column(length = 1000)
    private String description;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

### 2. DTO Layer

```java
@Data
@Builder
public class ProductDTO {
    private Long id;
    private String name;
    private BigDecimal price;
    private Integer stockQuantity;
    private String description;

    public static ProductDTO fromEntity(Product product) {
        return ProductDTO.builder()
            .id(product.getId())
            .name(product.getName())
            .price(product.getPrice())
            .stockQuantity(product.getStockQuantity())
            .description(product.getDescription())
            .build();
    }

    public Product toEntity() {
        Product product = new Product();
        product.setName(this.name);
        product.setPrice(this.price);
        product.setStockQuantity(this.stockQuantity);
        product.setDescription(this.description);
        return product;
    }
}
```

### 3. Repository Layer

```java
@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByPriceLessThan(BigDecimal price);

    @Query("SELECT p FROM Product p WHERE p.stockQuantity > 0")
    List<Product> findAvailableProducts();

    boolean existsByName(String name);
}
```

### 4. Service Layer

```java
@Service
@Transactional
@Slf4j
public class ProductService {
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<ProductDTO> getAllProducts() {
        return productRepository.findAll().stream()
            .map(ProductDTO::fromEntity)
            .collect(Collectors.toList());
    }

    public ProductDTO getProduct(Long id) {
        return productRepository.findById(id)
            .map(ProductDTO::fromEntity)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
    }

    public ProductDTO createProduct(ProductDTO productDTO) {
        if (productRepository.existsByName(productDTO.getName())) {
            throw new DuplicateResourceException("Product name already exists");
        }

        Product product = productDTO.toEntity();
        Product saved = productRepository.save(product);
        log.info("Created product: {}", saved.getId());
        return ProductDTO.fromEntity(saved);
    }

    public ProductDTO updateProduct(Long id, ProductDTO productDTO) {
        Product existing = productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));

        existing.setName(productDTO.getName());
        existing.setPrice(productDTO.getPrice());
        existing.setStockQuantity(productDTO.getStockQuantity());
        existing.setDescription(productDTO.getDescription());

        Product updated = productRepository.save(existing);
        log.info("Updated product: {}", id);
        return ProductDTO.fromEntity(updated);
    }

    public void deleteProduct(Long id) {
        if (!productRepository.existsById(id)) {
            throw new ResourceNotFoundException("Product not found: " + id);
        }
        productRepository.deleteById(id);
        log.info("Deleted product: {}", id);
    }
}
```

### 5. Controller Layer

```java
@RestController
@RequestMapping("/api/products")
@Tag(name = "Product API", description = "Product management endpoints")
public class ProductController {
    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    @Operation(summary = "Get all products")
    public List<ProductDTO> getAllProducts() {
        return productService.getAllProducts();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get product by ID")
    public ResponseEntity<ProductDTO> getProduct(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getProduct(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create new product")
    public ProductDTO createProduct(@Valid @RequestBody ProductDTO productDTO) {
        return productService.createProduct(productDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update existing product")
    public ProductDTO updateProduct(
        @PathVariable Long id,
        @Valid @RequestBody ProductDTO productDTO
    ) {
        return productService.updateProduct(id, productDTO);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete product")
    public void deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
    }
}
```

### 6. Exception Handling

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
        return new ErrorResponse(
            HttpStatus.NOT_FOUND.value(),
            ex.getMessage()
        );
    }

    @ExceptionHandler(DuplicateResourceException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleDuplicate(DuplicateResourceException ex) {
        return new ErrorResponse(
            HttpStatus.CONFLICT.value(),
            ex.getMessage()
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.toList());

        return new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation failed",
            errors
        );
    }
}

@Data
@AllArgsConstructor
public class ErrorResponse {
    private int status;
    private String message;
    private List<String> errors;

    public ErrorResponse(int status, String message) {
        this.status = status;
        this.message = message;
        this.errors = new ArrayList<>();
    }
}
```

## Common Pitfalls

1. ❌ Exposing entity objects directly
   ✅ Use DTOs for API responses

2. ❌ Missing validation
   ✅ Use @Valid and constraint annotations

3. ❌ Inconsistent error handling
   ✅ Implement global exception handler

4. ❌ Not using proper HTTP methods
   ✅ Follow REST conventions

## Best Practices

1. Use DTOs for request/response
2. Implement proper validation
3. Handle exceptions globally
4. Use meaningful HTTP status codes
5. Document APIs with OpenAPI/Swagger
6. Version your APIs
7. Implement pagination for collections
8. Use HATEOAS when appropriate

## Knowledge Check

- [ ] Explain REST principles
- [ ] List common HTTP status codes
- [ ] Describe DTO pattern benefits
- [ ] Explain exception handling
- [ ] Implement CRUD operations
- [ ] Use proper validation

## Additional Resources

- [Spring REST Documentation](https://docs.spring.io/spring-framework/reference/web/webmvc-rest.html)
- [REST API Tutorial](https://restfulapi.net/)
- [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html)
- [Spring HATEOAS](https://spring.io/projects/spring-hateoas)

---

⬅️ Previous: [Annotations Deep Dive](./04-annotations.md)

➡️ Next: [Request Mapping & Path Variables](./06-request-mapping.md)