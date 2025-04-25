# Caching in Spring Boot 🚀

## Overview

Master caching strategies in Spring Boot applications. Learn about cache configuration, cache providers, cache annotations, and best practices for optimal performance.

## Core Concepts

### 1. Cache Configuration

```java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager cacheManager = new SimpleCacheManager();
        cacheManager.setCaches(Arrays.asList(
            new ConcurrentMapCache("users"),
            new ConcurrentMapCache("products"),
            new ConcurrentMapCache("orders")
        ));
        return cacheManager;
    }
}

// Redis Cache Configuration
@Configuration
@EnableCaching
public class RedisCacheConfig {
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer())
            )
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()
                )
            );

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .withCacheConfiguration("users",
                RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)))
            .withCacheConfiguration("products",
                RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(15)))
            .build();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        return template;
    }
}
```

### 2. Cache Service

```java
@Service
@Slf4j
public class CacheService {
    private final CacheManager cacheManager;
    private final RedisTemplate<String, Object> redisTemplate;

    public CacheService(CacheManager cacheManager, RedisTemplate<String, Object> redisTemplate) {
        this.cacheManager = cacheManager;
        this.redisTemplate = redisTemplate;
    }

    public void evictCache(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
            log.info("Cache '{}' has been cleared", cacheName);
        }
    }

    public void evictCacheForKey(String cacheName, String key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.evict(key);
            log.info("Cache entry for key '{}' in cache '{}' has been evicted", key, cacheName);
        }
    }

    public <T> Optional<T> getFromCache(String cacheName, String key, Class<T> type) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            Cache.ValueWrapper wrapper = cache.get(key);
            if (wrapper != null && wrapper.get() != null) {
                return Optional.of(type.cast(wrapper.get()));
            }
        }
        return Optional.empty();
    }

    public void putInCache(String cacheName, String key, Object value) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.put(key, value);
            log.info("Value for key '{}' has been put in cache '{}'", key, cacheName);
        }
    }

    public void putInCacheWithExpiry(String key, Object value, Duration expiry) {
        redisTemplate.opsForValue().set(key, value, expiry);
        log.info("Value for key '{}' has been put in Redis with expiry {}", key, expiry);
    }
}
```

## Real-World Examples

### 1. Cached User Service

```java
@Service
@Slf4j
public class UserService {
    private final UserRepository userRepository;
    private final CacheService cacheService;

    private static final String CACHE_NAME = "users";

    @Cacheable(value = CACHE_NAME, key = "#id", unless = "#result == null")
    public UserDTO getUserById(Long id) {
        log.debug("Fetching user from database for id: {}", id);
        return userRepository.findById(id)
            .map(this::mapToDTO)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Cacheable(value = CACHE_NAME, key = "#email", unless = "#result == null")
    public UserDTO getUserByEmail(String email) {
        log.debug("Fetching user from database for email: {}", email);
        return userRepository.findByEmail(email)
            .map(this::mapToDTO)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @CachePut(value = CACHE_NAME, key = "#result.id")
    public UserDTO createUser(UserRegistrationRequest request) {
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user = userRepository.save(user);
        return mapToDTO(user);
    }

    @CachePut(value = CACHE_NAME, key = "#id")
    public UserDTO updateUser(Long id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user = userRepository.save(user);
        return mapToDTO(user);
    }

    @CacheEvict(value = CACHE_NAME, key = "#id")
    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    @CacheEvict(value = CACHE_NAME, allEntries = true)
    @Scheduled(cron = "0 0 0 * * ?") // Midnight every day
    public void evictAllCaches() {
        log.info("Evicting all entries from users cache");
    }
}
```

### 2. Cached Product Service with Custom Key Generator

```java
@Component
public class CustomKeyGenerator implements KeyGenerator {
    @Override
    public Object generate(Object target, Method method, Object... params) {
        StringBuilder key = new StringBuilder();
        key.append(target.getClass().getSimpleName()).append(":")
           .append(method.getName());

        for (Object param : params) {
            key.append(":").append(param);
        }

        return key.toString();
    }
}

@Service
@Slf4j
public class ProductService {
    private final ProductRepository productRepository;
    private final CacheService cacheService;

    private static final String CACHE_NAME = "products";

    @Cacheable(value = CACHE_NAME, keyGenerator = "customKeyGenerator")
    public List<ProductDTO> getProductsByCategory(String category, boolean includeInactive) {
        log.debug("Fetching products from database for category: {}", category);
        return productRepository.findByCategory(category, includeInactive)
            .stream()
            .map(this::mapToDTO)
            .collect(Collectors.toList());
    }

    @Cacheable(value = CACHE_NAME, key = "'price_range:' + #minPrice + ':' + #maxPrice")
    public List<ProductDTO> getProductsByPriceRange(BigDecimal minPrice, BigDecimal maxPrice) {
        log.debug("Fetching products from database for price range: {} - {}", minPrice, maxPrice);
        return productRepository.findByPriceBetween(minPrice, maxPrice)
            .stream()
            .map(this::mapToDTO)
            .collect(Collectors.toList());
    }

    @CachePut(value = CACHE_NAME, key = "#result.id")
    public ProductDTO updateProductPrice(Long id, BigDecimal newPrice) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        product.setPrice(newPrice);
        product.setLastPriceUpdate(LocalDateTime.now());
        product = productRepository.save(product);
        return mapToDTO(product);
    }

    @Caching(evict = {
        @CacheEvict(value = CACHE_NAME, key = "#id"),
        @CacheEvict(value = "productInventory", key = "#id")
    })
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }
}
```

### 3. Composite Cache Implementation

```java
@Service
@Slf4j
public class CompositeCache implements Cache {
    private final Cache localCache;
    private final Cache redisCache;
    private final String name;

    public CompositeCache(String name, Cache localCache, Cache redisCache) {
        this.name = name;
        this.localCache = localCache;
        this.redisCache = redisCache;
    }

    @Override
    public String getName() {
        return this.name;
    }

    @Override
    public Object getNativeCache() {
        return this;
    }

    @Override
    public ValueWrapper get(Object key) {
        // Try local cache first
        ValueWrapper wrapper = localCache.get(key);
        if (wrapper != null) {
            log.debug("Cache hit in local cache for key: {}", key);
            return wrapper;
        }

        // Try Redis cache
        wrapper = redisCache.get(key);
        if (wrapper != null) {
            log.debug("Cache hit in Redis cache for key: {}", key);
            // Update local cache
            localCache.put(key, wrapper.get());
            return wrapper;
        }

        return null;
    }

    @Override
    public void put(Object key, Object value) {
        localCache.put(key, value);
        redisCache.put(key, value);
    }

    @Override
    public void evict(Object key) {
        localCache.evict(key);
        redisCache.evict(key);
    }

    @Override
    public void clear() {
        localCache.clear();
        redisCache.clear();
    }
}

@Configuration
@EnableCaching
public class CompositeCacheConfig {
    @Bean
    public CacheManager compositeCacheManager(
            CacheManager localCacheManager,
            RedisCacheManager redisCacheManager) {

        return new CompositeCacheManager(localCacheManager, redisCacheManager);
    }
}
```

## Common Pitfalls

1. ❌ Caching without proper TTL
   ✅ Set appropriate expiration times

2. ❌ Caching mutable objects
   ✅ Cache immutable objects or DTOs

3. ❌ Over-caching
   ✅ Cache only frequently accessed data

4. ❌ Not monitoring cache performance
   ✅ Implement cache metrics and monitoring

## Best Practices

1. Use appropriate cache providers
2. Set cache expiration policies
3. Implement cache eviction strategies
4. Monitor cache performance
5. Use cache abstraction
6. Handle cache failures gracefully
7. Cache at the right level
8. Implement cache warming

## Knowledge Check

- [ ] Configure cache providers
- [ ] Implement cache annotations
- [ ] Set up cache eviction
- [ ] Use custom key generators
- [ ] Monitor cache metrics
- [ ] Handle cache failures

## Additional Resources

- [Spring Cache Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#cache)
- [Redis Documentation](https://redis.io/documentation)
- [Caffeine Cache](https://github.com/ben-manes/caffeine)
- [EhCache Documentation](https://www.ehcache.org/)

---

⬅️ Previous: [Logging](./18-logging.md)

➡️ Next: [Messaging](./20-messaging.md)