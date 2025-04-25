# Request Mapping & Path Variables 🛣️

## Overview

Master Spring Boot's request mapping capabilities for building flexible and maintainable REST endpoints. Learn how to handle URL patterns, path variables, and create clean API routing structures.

## Core Concepts

### Request Mapping Types
```java
@RequestMapping(method = RequestMethod.GET)    // Basic mapping
@GetMapping                                   // GET shortcut
@PostMapping                                  // POST shortcut
@PutMapping                                   // PUT shortcut
@DeleteMapping                                // DELETE shortcut
@PatchMapping                                 // PATCH shortcut
```

### URL Patterns
```java
"/products"                  // Basic path
"/products/{id}"            // Path variable
"/products/**"              // Wildcard matching
"/products/{*path}"         // Path variable matching rest of URL
"/products/*/details"       // Single-level wildcard
```

## Real-World Examples

### 1. Basic Controller Structure

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public List<OrderDTO> getAllOrders() {
        return orderService.getAllOrders();
    }

    @GetMapping("/{id}")
    public OrderDTO getOrder(@PathVariable Long id) {
        return orderService.getOrder(id);
    }

    @GetMapping("/user/{userId}")
    public List<OrderDTO> getUserOrders(@PathVariable Long userId) {
        return orderService.getOrdersByUserId(userId);
    }

    @GetMapping("/status/{status}")
    public List<OrderDTO> getOrdersByStatus(
        @PathVariable OrderStatus status,
        @RequestParam(required = false) LocalDate fromDate
    ) {
        return orderService.getOrdersByStatus(status, fromDate);
    }
}
```

### 2. Complex URL Patterns

```java
@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    // Match: /api/v1/products/categories/electronics/items
    @GetMapping("/categories/{category}/items")
    public List<ProductDTO> getProductsByCategory(@PathVariable String category) {
        return productService.findByCategory(category);
    }

    // Match: /api/v1/products/search/by-price/10.99/50.00
    @GetMapping("/search/by-price/{min}/{max}")
    public List<ProductDTO> searchByPriceRange(
        @PathVariable BigDecimal min,
        @PathVariable BigDecimal max
    ) {
        return productService.findByPriceRange(min, max);
    }

    // Match any sub-path under /api/v1/products/catalog/
    @GetMapping("/catalog/**")
    public List<ProductDTO> browseCatalog(HttpServletRequest request) {
        String fullPath = request.getRequestURI();
        return productService.browseCatalog(fullPath);
    }
}
```

### 3. Advanced Mapping Features

```java
@RestController
@RequestMapping("/api/v1/files")
public class FileController {

    // Consumes specific media type
    @PostMapping(
        value = "/upload",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public FileDTO uploadFile(@RequestParam("file") MultipartFile file) {
        return fileService.store(file);
    }

    // Produces specific media type
    @GetMapping(
        value = "/download/{id}",
        produces = MediaType.APPLICATION_OCTET_STREAM_VALUE
    )
    public ResponseEntity<Resource> downloadFile(@PathVariable Long id) {
        Resource file = fileService.loadAsResource(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + file.getFilename() + "\"")
            .body(file);
    }

    // Multiple path variables with regex
    @GetMapping("/{year:\\d{4}}/{month:\\d{2}}")
    public List<FileDTO> getFilesByDate(
        @PathVariable int year,
        @PathVariable int month
    ) {
        return fileService.findByDate(year, month);
    }
}
```

### 4. Request Header Handling

```java
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    // Required header
    @PostMapping("/login")
    public TokenDTO login(
        @RequestHeader("X-API-Key") String apiKey,
        @RequestBody LoginDTO loginDTO
    ) {
        return authService.authenticate(apiKey, loginDTO);
    }

    // Optional header with default
    @GetMapping("/session")
    public SessionDTO getSession(
        @RequestHeader(
            value = "Session-ID",
            required = false,
            defaultValue = "DEFAULT"
        ) String sessionId
    ) {
        return sessionService.getSession(sessionId);
    }

    // All headers
    @GetMapping("/debug")
    public Map<String, String> debug(@RequestHeader Map<String, String> headers) {
        return headers;
    }
}
```

### 5. Matrix Variables

```java
@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    // URL: /api/v1/search/products;category=electronics;brand=samsung
    @GetMapping("/products")
    public List<ProductDTO> searchProducts(
        @MatrixVariable(name = "category", required = false) String category,
        @MatrixVariable(name = "brand", required = false) String brand
    ) {
        return searchService.findProducts(category, brand);
    }

    // URL: /api/v1/search/filter;price=100-500;sort=price,desc
    @GetMapping("/filter")
    public List<ProductDTO> filterProducts(
        @MatrixVariable(name = "price") String priceRange,
        @MatrixVariable(name = "sort") String[] sortParams
    ) {
        String[] prices = priceRange.split("-");
        BigDecimal min = new BigDecimal(prices[0]);
        BigDecimal max = new BigDecimal(prices[1]);

        return searchService.filterProducts(min, max, sortParams);
    }
}
```

## Mini-Project: Hierarchical Resource API

Create an API for managing hierarchical resources:

```java
@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {
    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    // Basic CRUD for organizations
    @GetMapping("/{orgId}")
    public OrganizationDTO getOrganization(@PathVariable Long orgId) {
        return organizationService.getOrganization(orgId);
    }

    // Departments within organization
    @GetMapping("/{orgId}/departments")
    public List<DepartmentDTO> getDepartments(@PathVariable Long orgId) {
        return organizationService.getDepartments(orgId);
    }

    // Teams within department
    @GetMapping("/{orgId}/departments/{deptId}/teams")
    public List<TeamDTO> getTeams(
        @PathVariable Long orgId,
        @PathVariable Long deptId
    ) {
        return organizationService.getTeams(orgId, deptId);
    }

    // Employees within team
    @GetMapping("/{orgId}/departments/{deptId}/teams/{teamId}/employees")
    public List<EmployeeDTO> getEmployees(
        @PathVariable Long orgId,
        @PathVariable Long deptId,
        @PathVariable Long teamId
    ) {
        return organizationService.getEmployees(orgId, deptId, teamId);
    }

    // Search across hierarchy
    @GetMapping("/search/**")
    public List<SearchResultDTO> search(HttpServletRequest request) {
        String path = extractPath(request);
        return organizationService.search(path);
    }

    private String extractPath(HttpServletRequest request) {
        String fullPath = request.getRequestURI();
        String basePath = "/api/v1/organizations/search/";
        return fullPath.substring(basePath.length());
    }
}
```

## Common Pitfalls

1. ❌ Inconsistent URL patterns
   ✅ Follow REST naming conventions

2. ❌ Missing path variable validation
   ✅ Validate path variables and provide clear errors

3. ❌ Hardcoded URL paths
   ✅ Use constants or enums for URL paths

4. ❌ Not handling special characters in URLs
   ✅ Use proper URL encoding/decoding

## Best Practices

1. Use consistent URL naming patterns
2. Implement proper error handling
3. Version your APIs
4. Use appropriate HTTP methods
5. Keep URLs resource-focused
6. Handle special characters properly
7. Document all endpoints
8. Use meaningful status codes

## Knowledge Check

- [ ] Explain different request mapping types
- [ ] Describe URL pattern matching
- [ ] Handle path variables correctly
- [ ] Use matrix variables
- [ ] Implement hierarchical URLs
- [ ] Handle request headers

## Additional Resources

- [Spring MVC RequestMapping](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html)
- [RESTful URL Design](https://www.restapitutorial.com/lessons/restfulresourcenaming.html)
- [Spring URL Pattern Matching](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html#mvc-ann-requestmapping-pattern-comparison)
- [Matrix Variables in Spring MVC](https://www.baeldung.com/spring-mvc-matrix-variables)

---

⬅️ Previous: [Building REST APIs](./05-rest-apis.md)

➡️ Next: [Handling Query Params and Request Bodies](./07-request-handling.md)