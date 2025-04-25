# Handling Query Params and Request Bodies 📝

## Overview

Learn how to effectively handle various types of request data in Spring Boot applications, including query parameters, request bodies, form data, and multipart requests.

## Core Concepts

### Request Parameter Types
```java
@RequestParam             // Query parameters
@RequestBody             // JSON/XML body
@RequestPart             // Multipart files
@ModelAttribute          // Form data
@RequestHeader          // HTTP headers
@CookieValue           // Cookie values
```

### Parameter Binding
```java
// Required vs Optional
@RequestParam(required = false)
@RequestParam(defaultValue = "10")

// Name mapping
@RequestParam("user_id")
@RequestParam(name = "user_id")

// Collection binding
@RequestParam List<String> tags
@RequestParam Map<String, String> filters
```

## Real-World Examples

### 1. Advanced Query Parameter Handling

```java
@RestController
@RequestMapping("/api/v1/search")
public class SearchController {
    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/products")
    public Page<ProductDTO> searchProducts(
        @RequestParam(required = false) String query,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "name,asc") String[] sort,
        @RequestParam Map<String, String> filters
    ) {
        SearchCriteria criteria = SearchCriteria.builder()
            .query(query)
            .page(page)
            .size(size)
            .sort(parseSort(sort))
            .filters(filters)
            .build();

        return searchService.searchProducts(criteria);
    }

    private Sort parseSort(String[] sort) {
        List<Sort.Order> orders = new ArrayList<>();
        for (String s : sort) {
            String[] parts = s.split(",");
            Sort.Direction direction = parts.length > 1
                ? Sort.Direction.fromString(parts[1])
                : Sort.Direction.ASC;
            orders.add(new Sort.Order(direction, parts[0]));
        }
        return Sort.by(orders);
    }
}
```

### 2. Complex Request Body Processing

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(@Valid @RequestBody OrderRequest request) {
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(orderService.createOrder(request));
    }
}

@Data
@Builder
public class OrderRequest {
    @NotNull
    private Long customerId;

    @NotEmpty
    private List<OrderItemRequest> items;

    @Valid
    private ShippingAddress shippingAddress;

    private String couponCode;

    @Pattern(regexp = "STANDARD|EXPRESS|NEXT_DAY")
    private String shippingMethod;
}

@Data
public class OrderItemRequest {
    @NotNull
    private Long productId;

    @Min(1)
    private int quantity;

    @Valid
    private List<ProductCustomization> customizations;
}

@Data
public class ShippingAddress {
    @NotBlank
    private String street;

    @NotBlank
    private String city;

    @NotBlank
    @Pattern(regexp = "^[0-9]{5}(?:-[0-9]{4})?$")
    private String zipCode;

    @NotBlank
    @Size(min = 2, max = 2)
    private String state;
}
```

### 3. File Upload Handling

```java
@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentDTO> uploadDocument(
        @RequestPart("file") MultipartFile file,
        @RequestPart("metadata") @Valid DocumentMetadata metadata,
        @RequestParam(required = false) String folder
    ) {
        // Validate file
        if (file.isEmpty()) {
            throw new BadRequestException("File cannot be empty");
        }

        // Validate file type
        String contentType = file.getContentType();
        if (!allowedContentTypes.contains(contentType)) {
            throw new BadRequestException("Unsupported file type: " + contentType);
        }

        // Process upload
        DocumentDTO document = documentService.store(file, metadata, folder);

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(document);
    }

    @PostMapping("/batch")
    public ResponseEntity<List<DocumentDTO>> uploadMultipleDocuments(
        @RequestPart("files") List<MultipartFile> files,
        @RequestPart("metadata") @Valid List<DocumentMetadata> metadata
    ) {
        if (files.size() != metadata.size()) {
            throw new BadRequestException("Files and metadata count mismatch");
        }

        List<DocumentDTO> documents = new ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            documents.add(documentService.store(files.get(i), metadata.get(i)));
        }

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(documents);
    }
}
```

### 4. Form Data Processing

```java
@Controller
@RequestMapping("/profile")
public class ProfileController {

    @PostMapping("/update")
    public String updateProfile(
        @ModelAttribute @Valid ProfileUpdateForm form,
        BindingResult result,
        RedirectAttributes redirectAttributes
    ) {
        if (result.hasErrors()) {
            return "profile/edit";
        }

        try {
            profileService.updateProfile(form);
            redirectAttributes.addFlashAttribute("message", "Profile updated successfully");
            return "redirect:/profile";
        } catch (Exception e) {
            result.rejectValue("global", "error.global", "Failed to update profile");
            return "profile/edit";
        }
    }
}

@Data
public class ProfileUpdateForm {
    @NotBlank
    private String displayName;

    @Email
    private String email;

    @Size(max = 500)
    private String bio;

    @Pattern(regexp = "^[A-Za-z0-9_]{1,15}$")
    private String twitterHandle;

    @URL
    private String websiteUrl;

    @Valid
    private List<SocialMediaLink> socialLinks;
}
```

### 5. Request Validation and Error Handling

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @PostMapping
    public ResponseEntity<UserDTO> createUser(
        @RequestBody @Valid UserCreateRequest request,
        @RequestHeader("X-API-Version") String apiVersion
    ) {
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(userService.createUser(request, apiVersion));
    }
}

@RestControllerAdvice
public class ValidationExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ValidationErrorResponse handleValidationException(
        MethodArgumentNotValidException ex
    ) {
        List<FieldError> fieldErrors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error -> new FieldError(
                error.getField(),
                error.getRejectedValue(),
                error.getDefaultMessage()
            ))
            .collect(Collectors.toList());

        return new ValidationErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation failed",
            fieldErrors
        );
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMissingParams(
        MissingServletRequestParameterException ex
    ) {
        return new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            String.format("Missing required parameter: %s", ex.getParameterName())
        );
    }
}
```

## Common Pitfalls

1. ❌ Not validating request parameters
   ✅ Use @Valid and custom validators

2. ❌ Hardcoding parameter names
   ✅ Use constants or enums

3. ❌ Missing content type validation
   ✅ Validate content types for file uploads

4. ❌ Not handling optional parameters properly
   ✅ Use Optional<T> or default values

## Best Practices

1. Always validate input data
2. Use DTOs for complex requests
3. Handle multipart requests properly
4. Implement proper error responses
5. Document request parameters
6. Use appropriate parameter types
7. Handle character encoding
8. Implement rate limiting

## Knowledge Check

- [ ] Handle query parameters
- [ ] Process request bodies
- [ ] Manage file uploads
- [ ] Validate input data
- [ ] Handle form submissions
- [ ] Implement error handling

## Additional Resources

- [Spring Request Parameters](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/requestparam.html)
- [Spring Request Body](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/requestbody.html)
- [File Upload Tutorial](https://spring.io/guides/gs/uploading-files/)
- [Bean Validation](https://beanvalidation.org/2.0/spec/)

---

⬅️ Previous: [Request Mapping & Path Variables](./06-request-mapping.md)

➡️ Next: [Service Layer & Dependency Injection](./08-service-layer.md)