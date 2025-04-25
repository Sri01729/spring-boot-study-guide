# Spring Data JPA 🗄️

## Overview

Master Spring Data JPA for efficient database operations. Learn entity mapping, repositories, relationships, queries, and transactions.

## Core Concepts

### Entity Mapping
```java
@Entity
@Table(name = "products")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    @Enumerated(EnumType.STRING)
    private ProductStatus status;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Version
    private Long version;
}
```

### Repository Interface
```java
public interface ProductRepository extends JpaRepository<Product, Long> {
    // Derived query methods
    Optional<Product> findByName(String name);
    List<Product> findByStatusAndStockQuantityGreaterThan(
        ProductStatus status,
        Integer minStock
    );

    // Custom query
    @Query("SELECT p FROM Product p WHERE p.price BETWEEN :min AND :max")
    List<Product> findByPriceRange(
        @Param("min") BigDecimal min,
        @Param("max") BigDecimal max
    );

    // Native query
    @Query(
        value = "SELECT * FROM products WHERE MATCH(name, description) AGAINST (?1)",
        nativeQuery = true
    )
    List<Product> fullTextSearch(String searchTerm);
}
```

## Real-World Examples

### 1. Complex Entity Relationships

```java
@Entity
@Table(name = "orders")
@Data
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @OneToMany(
        mappedBy = "order",
        cascade = CascadeType.ALL,
        orphanRemoval = true
    )
    private List<OrderItem> items = new ArrayList<>();

    @OneToOne(
        mappedBy = "order",
        cascade = CascadeType.ALL,
        fetch = FetchType.LAZY
    )
    private Payment payment;

    @Embedded
    private Address shippingAddress;

    @ElementCollection
    @CollectionTable(
        name = "order_status_history",
        joinColumns = @JoinColumn(name = "order_id")
    )
    private List<StatusChange> statusHistory = new ArrayList<>();

    @Convert(converter = JsonAttributeConverter.class)
    @Column(columnDefinition = "json")
    private Map<String, Object> metadata;

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void removeItem(OrderItem item) {
        items.remove(item);
        item.setOrder(null);
    }
}

@Entity
@Table(name = "order_items")
@Data
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    private Integer quantity;

    @Column(nullable = false)
    private BigDecimal price;

    @Convert(converter = JsonAttributeConverter.class)
    @Column(columnDefinition = "json")
    private Map<String, Object> customizations;
}

@Embeddable
@Data
public class Address {
    @Column(nullable = false)
    private String street;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false)
    private String state;

    @Column(nullable = false)
    private String zipCode;

    @Column(nullable = false)
    private String country;
}

@Embeddable
@Data
public class StatusChange {
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(length = 500)
    private String comment;

    @Column(name = "changed_by")
    private String changedBy;
}
```

### 2. Advanced Repository Operations

```java
@Repository
public interface OrderRepository extends
    JpaRepository<Order, Long>,
    JpaSpecificationExecutor<Order> {

    @Query("""
        SELECT o FROM Order o
        LEFT JOIN FETCH o.items i
        LEFT JOIN FETCH i.product p
        LEFT JOIN FETCH o.customer c
        WHERE o.id = :orderId
    """)
    Optional<Order> findByIdWithDetails(@Param("orderId") Long orderId);

    @Query("""
        SELECT NEW com.example.dto.OrderSummaryDTO(
            o.id,
            c.name,
            COUNT(i),
            SUM(i.quantity * i.price)
        )
        FROM Order o
        JOIN o.customer c
        JOIN o.items i
        WHERE o.createdAt >= :startDate
        GROUP BY o.id, c.name
        HAVING SUM(i.quantity * i.price) >= :minAmount
    """)
    List<OrderSummaryDTO> findOrderSummaries(
        @Param("startDate") LocalDateTime startDate,
        @Param("minAmount") BigDecimal minAmount
    );

    @Modifying
    @Query("""
        UPDATE Order o
        SET o.status = :status,
        o.updatedAt = CURRENT_TIMESTAMP
        WHERE o.id IN :orderIds
        AND o.status = :currentStatus
    """)
    int updateOrderStatus(
        @Param("orderIds") List<Long> orderIds,
        @Param("currentStatus") OrderStatus currentStatus,
        @Param("status") OrderStatus status
    );
}

@Component
public class OrderSpecifications {
    public static Specification<Order> hasStatus(OrderStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Order> createdBetween(
        LocalDateTime start,
        LocalDateTime end
    ) {
        return (root, query, cb) ->
            cb.between(root.get("createdAt"), start, end);
    }

    public static Specification<Order> hasMinAmount(BigDecimal minAmount) {
        return (root, query, cb) -> {
            Join<Order, OrderItem> items = root.join("items");
            return cb.ge(
                cb.sum(
                    cb.prod(items.get("quantity"), items.get("price"))
                ),
                minAmount
            );
        };
    }
}
```

### 3. Custom Repository Implementation

```java
public interface CustomOrderRepository {
    List<Order> findOrdersByComplexCriteria(OrderSearchCriteria criteria);
    void bulkUpdateOrders(List<OrderUpdateDTO> updates);
}

@Repository
public class CustomOrderRepositoryImpl implements CustomOrderRepository {
    @PersistenceContext
    private EntityManager em;

    @Override
    public List<Order> findOrdersByComplexCriteria(OrderSearchCriteria criteria) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Order> query = cb.createQuery(Order.class);
        Root<Order> order = query.from(Order.class);

        List<Predicate> predicates = new ArrayList<>();

        if (criteria.getStatus() != null) {
            predicates.add(cb.equal(order.get("status"), criteria.getStatus()));
        }

        if (criteria.getDateRange() != null) {
            predicates.add(cb.between(
                order.get("createdAt"),
                criteria.getDateRange().getStart(),
                criteria.getDateRange().getEnd()
            ));
        }

        if (criteria.getCustomerId() != null) {
            predicates.add(cb.equal(
                order.get("customer").get("id"),
                criteria.getCustomerId()
            ));
        }

        if (criteria.getMinAmount() != null) {
            Join<Order, OrderItem> items = order.join("items");
            predicates.add(cb.ge(
                cb.sum(cb.prod(
                    items.get("quantity"),
                    items.get("price")
                )),
                criteria.getMinAmount()
            ));
        }

        query.where(predicates.toArray(new Predicate[0]));

        if (criteria.getSortBy() != null) {
            if (criteria.getSortDirection() == Sort.Direction.ASC) {
                query.orderBy(cb.asc(order.get(criteria.getSortBy())));
            } else {
                query.orderBy(cb.desc(order.get(criteria.getSortBy())));
            }
        }

        TypedQuery<Order> typedQuery = em.createQuery(query);

        if (criteria.getPage() != null && criteria.getSize() != null) {
            typedQuery.setFirstResult(criteria.getPage() * criteria.getSize());
            typedQuery.setMaxResults(criteria.getSize());
        }

        return typedQuery.getResultList();
    }

    @Override
    @Transactional
    public void bulkUpdateOrders(List<OrderUpdateDTO> updates) {
        for (OrderUpdateDTO update : updates) {
            em.createQuery("""
                UPDATE Order o
                SET o.status = :status,
                    o.updatedAt = CURRENT_TIMESTAMP,
                    o.metadata = :metadata
                WHERE o.id = :orderId
            """)
            .setParameter("status", update.getStatus())
            .setParameter("metadata", update.getMetadata())
            .setParameter("orderId", update.getOrderId())
            .executeUpdate();
        }
        em.flush();
        em.clear();
    }
}
```

### 4. Auditing and Versioning

```java
@Configuration
@EnableJpaAuditing
public class JpaConfig {
    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName);
    }
}

@EntityListeners(AuditingEntityListener.class)
@MappedSuperclass
@Data
public abstract class Auditable {
    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedBy
    private String lastModifiedBy;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Version
    private Long version;
}

@Entity
@Table(name = "products")
@Data
@EqualsAndHashCode(callSuper = true)
public class Product extends Auditable {
    // ... product fields ...
}
```

## Common Pitfalls

1. ❌ N+1 query problem
   ✅ Use fetch joins

2. ❌ Lazy loading outside transaction
   ✅ Use @Transactional or fetch eagerly

3. ❌ Inefficient queries
   ✅ Use proper indexing and query optimization

4. ❌ Entity relationships without cascade
   ✅ Configure appropriate cascade types

## Best Practices

1. Use appropriate fetch types
2. Implement proper indexing
3. Use query optimization
4. Handle transactions correctly
5. Implement auditing
6. Use versioning for concurrency
7. Follow naming conventions
8. Use specification pattern

## Knowledge Check

- [ ] Create entity mappings
- [ ] Define relationships
- [ ] Write custom queries
- [ ] Implement specifications
- [ ] Handle transactions
- [ ] Optimize performance

## Additional Resources

- [Spring Data JPA](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
- [JPA Reference](https://docs.oracle.com/javaee/7/tutorial/persistence-intro.htm)
- [Hibernate Documentation](https://hibernate.org/orm/documentation/5.4/)
- [Query Optimization](https://vladmihalcea.com/tutorials/hibernate/)

---

⬅️ Previous: [Service Layer](./08-service-layer.md)

➡️ Next: [Error Handling](./11-error-handling.md)