# Performance Optimization in Spring Boot ⚡

## Overview

Master performance optimization techniques in Spring Boot applications. Learn about caching, connection pooling, async processing, and performance best practices.

## Core Concepts

### 1. Caching Configuration

```java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        RedisCacheManager.RedisCacheManagerBuilder builder =
            RedisCacheManager.builder(lettuceConnectionFactory())
                .cacheDefaults(defaultConfig());

        return builder.build();
    }

    private RedisCacheConfiguration defaultConfig() {
        return RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer())
            )
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer())
            );
    }

    @Bean
    public RedisConnectionFactory lettuceConnectionFactory() {
        LettuceConnectionFactory lcf = new LettuceConnectionFactory();
        lcf.setShareNativeConnection(false);
        return lcf;
    }
}

@Service
@CacheConfig(cacheNames = {"users"})
public class UserService {
    @Cacheable(key = "#id")
    public User getUser(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @CachePut(key = "#user.id")
    public User updateUser(User user) {
        return userRepository.save(user);
    }

    @CacheEvict(key = "#id")
    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }
}
```

### 2. Connection Pooling

```java
@Configuration
public class DatabaseConfig {
    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariConfig hikariConfig() {
        HikariConfig config = new HikariConfig();
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(5);
        config.setIdleTimeout(300000);
        config.setConnectionTimeout(20000);
        config.setMaxLifetime(1200000);
        return config;
    }

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource(hikariConfig());
    }
}

# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      idle-timeout: 300000
      connection-timeout: 20000
      max-lifetime: 1200000
```

### 3. Async Processing

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {
    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("AsyncThread-");
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new SimpleAsyncUncaughtExceptionHandler();
    }
}

@Service
@Slf4j
public class AsyncService {
    @Async
    public CompletableFuture<String> processAsync(String data) {
        // Simulate long processing
        try {
            Thread.sleep(1000);
            return CompletableFuture.completedFuture("Processed: " + data);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CompletableFuture.failedFuture(e);
        }
    }
}
```

## Real-World Examples

### 1. Query Optimization

```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Bad: Fetches all users then filters in memory
    @Query("SELECT u FROM User u")
    List<User> findAllUsers();

    // Good: Filters at database level
    @Query("SELECT u FROM User u WHERE u.status = :status")
    List<User> findByStatus(@Param("status") String status);

    // Better: Paginate results
    @Query("SELECT u FROM User u WHERE u.status = :status")
    Page<User> findByStatus(@Param("status") String status, Pageable pageable);

    // Best: Optimize with indexes and fetch only needed fields
    @Query("SELECT new com.example.dto.UserSummaryDTO(u.id, u.name) " +
           "FROM User u WHERE u.status = :status")
    Page<UserSummaryDTO> findUserSummaries(@Param("status") String status,
                                          Pageable pageable);
}

@Service
public class OptimizedUserService {
    private final UserRepository userRepository;

    public Page<UserSummaryDTO> getActiveUsers(int page, int size) {
        return userRepository.findUserSummaries(
            "ACTIVE",
            PageRequest.of(page, size, Sort.by("name"))
        );
    }
}
```

### 2. Batch Processing

```java
@Service
@Slf4j
public class BatchProcessingService {
    private final JdbcTemplate jdbcTemplate;
    private final EntityManager entityManager;

    @Transactional
    public void batchInsertUsers(List<User> users) {
        String sql = "INSERT INTO users (name, email, status) VALUES (?, ?, ?)";

        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                User user = users.get(i);
                ps.setString(1, user.getName());
                ps.setString(2, user.getEmail());
                ps.setString(3, user.getStatus());
            }

            @Override
            public int getBatchSize() {
                return users.size();
            }
        });
    }

    @Transactional
    public void batchUpdateWithJPA(List<User> users) {
        final int batchSize = 50;
        for (int i = 0; i < users.size(); i++) {
            entityManager.merge(users.get(i));
            if (i % batchSize == 0) {
                entityManager.flush();
                entityManager.clear();
            }
        }
    }
}
```

### 3. Response Compression

```java
@Configuration
public class CompressionConfig {
    @Bean
    public GZipFilter gzipFilter() {
        return new GZipFilter();
    }
}

@RestController
@RequestMapping("/api")
public class OptimizedController {
    @GetMapping(value = "/large-data", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<DataDTO>> getLargeData() {
        List<DataDTO> data = service.getLargeData();

        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl(CacheControl.maxAge(1, TimeUnit.HOURS));
        headers.setContentType(MediaType.APPLICATION_JSON);

        return ResponseEntity.ok()
            .headers(headers)
            .body(data);
    }
}
```

## Common Pitfalls

1. ❌ N+1 query problem
   ✅ Use join fetching or batch loading

2. ❌ Loading unnecessary data
   ✅ Use projections and pagination

3. ❌ Missing database indexes
   ✅ Add appropriate indexes

4. ❌ Inefficient caching
   ✅ Implement proper cache strategies

## Best Practices

1. Use connection pooling
2. Implement caching
3. Optimize database queries
4. Use async processing
5. Implement batch operations
6. Enable compression
7. Profile application
8. Monitor performance metrics

## Knowledge Check

- [ ] Configure caching
- [ ] Optimize database queries
- [ ] Implement connection pooling
- [ ] Set up async processing
- [ ] Use batch operations
- [ ] Enable response compression

## Additional Resources

- [Spring Performance Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/performance.html)
- [Hibernate Performance Guide](https://docs.jboss.org/hibernate/orm/5.4/performance/html_single/Performance_Guide.html)
- [Redis Documentation](https://redis.io/documentation)
- [HikariCP](https://github.com/brettwooldridge/HikariCP)

---

⬅️ Previous: [Deployment](./12-deployment.md)

➡️ Next: [Scheduling](./14-scheduling.md)