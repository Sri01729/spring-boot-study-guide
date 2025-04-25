# Spring Boot Pagination 📑

## Overview

Master pagination and sorting in Spring Boot applications. Learn about implementing efficient data retrieval with pagination, sorting, and filtering capabilities.

## Core Concepts

### 1. Basic Pagination Configuration

```java
@Configuration
public class PaginationConfig {
    @Bean
    public PageableHandlerMethodArgumentResolver pageableResolver() {
        PageableHandlerMethodArgumentResolver resolver =
            new PageableHandlerMethodArgumentResolver();
        resolver.setOneIndexedParameters(true);
        resolver.setMaxPageSize(100);
        resolver.setFallbackPageable(
            PageRequest.of(0, 20, Sort.by("id").descending()));
        return resolver;
    }
}
```

### 2. Pageable Repository

```java
@Repository
public interface ProductRepository
        extends JpaRepository<Product, Long> {

    Page<Product> findByCategory(
        String category, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE " +
           "(:minPrice IS NULL OR p.price >= :minPrice) AND " +
           "(:maxPrice IS NULL OR p.price <= :maxPrice) AND " +
           "(:category IS NULL OR p.category = :category)")
    Page<Product> findWithFilters(
        @Param("minPrice") BigDecimal minPrice,
        @Param("maxPrice") BigDecimal maxPrice,
        @Param("category") String category,
        Pageable pageable);

    @Query(value = "SELECT p.* FROM products p " +
                   "LEFT JOIN product_ratings r " +
                   "ON p.id = r.product_id " +
                   "GROUP BY p.id " +
                   "ORDER BY AVG(r.rating) DESC",
           countQuery = "SELECT COUNT(DISTINCT p.id) " +
                       "FROM products p " +
                       "LEFT JOIN product_ratings r " +
                       "ON p.id = r.product_id",
           nativeQuery = true)
    Page<Product> findTopRated(Pageable pageable);
}
```

### 3. Pagination Service

```java
@Service
@Slf4j
public class PaginationService<T> {
    private final ApplicationEventPublisher eventPublisher;

    public PageResponse<T> createPageResponse(
            Page<T> page,
            String baseUrl,
            MultiValueMap<String, String> params) {

        params.remove("page");
        params.remove("size");
        params.remove("sort");

        String queryString = params.isEmpty() ? "" :
            "?" + params.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&"));

        return PageResponse.<T>builder()
            .content(page.getContent())
            .pageNumber(page.getNumber() + 1)
            .pageSize(page.getSize())
            .totalElements(page.getTotalElements())
            .totalPages(page.getTotalPages())
            .first(createPageUrl(baseUrl, 1, page.getSize(),
                page.getSort(), queryString))
            .last(createPageUrl(baseUrl, page.getTotalPages(),
                page.getSize(), page.getSort(), queryString))
            .next(page.hasNext() ? createPageUrl(baseUrl,
                page.getNumber() + 2, page.getSize(),
                page.getSort(), queryString) : null)
            .previous(page.hasPrevious() ? createPageUrl(
                baseUrl, page.getNumber(), page.getSize(),
                page.getSort(), queryString) : null)
            .build();
    }

    private String createPageUrl(String baseUrl, int page,
            int size, Sort sort, String queryString) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append(queryString.isEmpty() ? "?" : queryString + "&");
        url.append("page=").append(page);
        url.append("&size=").append(size);

        if (sort != null && sort.isSorted()) {
            sort.forEach(order -> {
                url.append("&sort=")
                   .append(order.getProperty())
                   .append(",")
                   .append(order.getDirection());
            });
        }

        return url.toString();
    }

    public void validatePageRequest(Pageable pageable,
            int maxPageSize) {
        if (pageable.getPageSize() > maxPageSize) {
            throw new InvalidPageRequestException(
                "Page size cannot exceed " + maxPageSize);
        }
    }
}
```

## Real-World Examples

### 1. Product Catalog Service

```java
@Service
@Slf4j
public class ProductCatalogService {
    private final ProductRepository productRepository;
    private final PaginationService<Product> paginationService;
    private final ProductSearchService searchService;
    private final MetricsService metricsService;

    @Cacheable(cacheNames = "products",
        key = "#category + '_' + #pageable.pageNumber + '_' +
              #pageable.pageSize + '_' + #pageable.sort")
    public PageResponse<Product> getProductsByCategory(
            String category,
            Pageable pageable,
            String baseUrl,
            MultiValueMap<String, String> params) {

        paginationService.validatePageRequest(pageable, 100);

        Page<Product> products = productRepository
            .findByCategory(category, pageable);

        metricsService.recordPageAccess(
            "products", category, pageable);

        return paginationService.createPageResponse(
            products, baseUrl, params);
    }

    public PageResponse<Product> searchProducts(
            ProductSearchCriteria criteria,
            Pageable pageable,
            String baseUrl,
            MultiValueMap<String, String> params) {

        paginationService.validatePageRequest(pageable, 50);

        Page<Product> products;
        if (criteria.hasFullTextSearch()) {
            products = searchService.searchProducts(
                criteria.getSearchTerm(), pageable);
        } else {
            products = productRepository.findWithFilters(
                criteria.getMinPrice(),
                criteria.getMaxPrice(),
                criteria.getCategory(),
                pageable);
        }

        metricsService.recordSearch(
            "products", criteria, pageable);

        return paginationService.createPageResponse(
            products, baseUrl, params);
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    public void updateTopRatedProducts() {
        Page<Product> topRated = productRepository
            .findTopRated(PageRequest.of(0, 10));

        cacheManager.getCache("top-rated")
            .put("products", topRated.getContent());
    }
}
```

### 2. Audit Log Service

```java
@Service
@Slf4j
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;
    private final PaginationService<AuditLog> paginationService;
    private final SecurityService securityService;

    public PageResponse<AuditLog> searchAuditLogs(
            AuditLogSearchCriteria criteria,
            Pageable pageable,
            String baseUrl,
            MultiValueMap<String, String> params) {

        securityService.validateAuditLogAccess();
        paginationService.validatePageRequest(pageable, 1000);

        Specification<AuditLog> spec = buildSpecification(
            criteria);

        Page<AuditLog> logs = auditLogRepository
            .findAll(spec, pageable);

        if (criteria.isExportRequested()) {
            exportAuditLogs(logs.getContent());
        }

        return paginationService.createPageResponse(
            logs, baseUrl, params);
    }

    private Specification<AuditLog> buildSpecification(
            AuditLogSearchCriteria criteria) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (criteria.getStartDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                    root.get("timestamp"),
                    criteria.getStartDate()));
            }

            if (criteria.getEndDate() != null) {
                predicates.add(cb.lessThanOrEqualTo(
                    root.get("timestamp"),
                    criteria.getEndDate()));
            }

            if (criteria.getUser() != null) {
                predicates.add(cb.equal(
                    root.get("user"),
                    criteria.getUser()));
            }

            if (criteria.getAction() != null) {
                predicates.add(cb.equal(
                    root.get("action"),
                    criteria.getAction()));
            }

            return cb.and(predicates.toArray(
                new Predicate[0]));
        };
    }
}
```

### 3. Dynamic Report Service

```java
@Service
@Slf4j
public class ReportService {
    private final ReportRepository reportRepository;
    private final PaginationService<Report> paginationService;
    private final AsyncReportGenerator reportGenerator;

    @Transactional(readOnly = true)
    public PageResponse<Report> getReports(
            ReportCriteria criteria,
            Pageable pageable,
            String baseUrl,
            MultiValueMap<String, String> params) {

        paginationService.validatePageRequest(pageable, 50);

        Page<Report> reports;
        if (criteria.isDynamic()) {
            reports = reportGenerator.generateDynamicReports(
                criteria, pageable);
        } else {
            reports = reportRepository.findWithFilters(
                criteria, pageable);
        }

        return paginationService.createPageResponse(
            reports, baseUrl, params);
    }

    @Async
    public CompletableFuture<byte[]> exportReports(
            ReportCriteria criteria,
            Sort sort) {
        return CompletableFuture.supplyAsync(() -> {
            int pageSize = 1000;
            int pageNumber = 0;
            ByteArrayOutputStream output =
                new ByteArrayOutputStream();

            Page<Report> page;
            do {
                page = reportRepository.findWithFilters(
                    criteria,
                    PageRequest.of(pageNumber++, pageSize,
                        sort));

                writeToOutputStream(output, page.getContent());
            } while (page.hasNext());

            return output.toByteArray();
        });
    }
}
```

## Common Pitfalls

1. ❌ Not handling large result sets
   ✅ Use appropriate page sizes

2. ❌ Inefficient count queries
   ✅ Optimize count queries for large datasets

3. ❌ Missing sort validation
   ✅ Validate and sanitize sort parameters

4. ❌ Not considering performance
   ✅ Use caching and optimization strategies

## Best Practices

1. Use appropriate page sizes
2. Implement efficient sorting
3. Cache frequently accessed pages
4. Validate page requests
5. Handle edge cases
6. Provide clear navigation
7. Monitor performance
8. Document pagination APIs

## Knowledge Check

- [ ] Configure basic pagination
- [ ] Implement custom repositories
- [ ] Handle sorting and filtering
- [ ] Optimize performance
- [ ] Implement caching
- [ ] Handle edge cases

## Additional Resources

- [Spring Data JPA](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#repositories.special-parameters)
- [Pagination and Sorting](https://docs.spring.io/spring-data/rest/docs/current/reference/html/#paging-and-sorting)
- [Query Methods](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#repositories.query-methods)
- [Performance Tuning](https://vladmihalcea.com/tutorials/hibernate/)

---

⬅️ Previous: [File Operations](./26-file-operations.md)

➡️ Next: [External APIs](./28-external-apis.md)