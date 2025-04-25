# Introduction to Spring & Spring Boot 🌱

## Overview

Spring Boot is an opinionated framework that simplifies the development of production-ready Spring applications. This module covers core concepts, key benefits, and fundamental architecture.

## Core Concepts

### What is Spring?
- Component-based framework for building enterprise Java applications
- Provides infrastructure support so you focus on business logic
- Core features: Dependency Injection (DI) and Aspect-Oriented Programming (AOP)

### What is Spring Boot?
- Built on top of Spring Framework
- Eliminates boilerplate configuration
- Provides embedded servers and "starters"
- Production-ready features out of the box

### Key Benefits
- Rapid development
- Stand-alone applications
- Production-ready defaults
- No code generation
- No XML configuration required

## Real-World Use Cases

1. **Netflix**: Uses Spring Boot for their edge services
2. **Alibaba**: Powers their microservices architecture
3. **Capital One**: Backend for financial applications
4. **Accenture**: Enterprise client solutions

## Hands-on Example

Let's create a minimal Spring Boot application:

```java
@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }

    @RestController
    class HelloController {
        @GetMapping("/hello")
        String hello() {
            return "Hello, Spring Boot!";
        }
    }
}
```

### Key Components Explained:
- `@SpringBootApplication`: Enables auto-configuration and component scanning
- `SpringApplication.run()`: Bootstraps the application
- `@RestController`: Marks class as REST endpoint provider
- `@GetMapping`: Maps HTTP GET requests to methods

## Mini-Project: Health Check API

Create a simple health check API that:
1. Returns system status
2. Includes application version
3. Shows system time

```java
@RestController
@RequestMapping("/api/health")
public class HealthCheckController {
    @Value("${spring.application.version:1.0.0}")
    private String version;

    @GetMapping
    public Map<String, Object> healthCheck() {
        return Map.of(
            "status", "UP",
            "version", version,
            "timestamp", LocalDateTime.now(),
            "runtime", Runtime.getRuntime().freeMemory()
        );
    }
}
```

## Common Pitfalls

1. ❌ Treating Spring Boot like a traditional Spring application
   ✅ Leverage auto-configuration and starter dependencies

2. ❌ Over-configuring the application
   ✅ Trust Spring Boot's defaults unless you have specific needs

3. ❌ Missing actuator endpoints for production
   ✅ Always include spring-boot-actuator in production apps

4. ❌ Not using proper profiles
   ✅ Configure different environments (dev, test, prod) using profiles

## Best Practices

1. Follow convention over configuration
2. Use starter dependencies
3. Implement proper health checks
4. Configure logging appropriately
5. Use application.yml over application.properties
6. Implement graceful shutdown

## Knowledge Check

- [ ] What problem does Spring Boot solve?
- [ ] Name three Spring Boot starters
- [ ] Explain auto-configuration
- [ ] Describe the purpose of @SpringBootApplication
- [ ] List three production-ready features
- [ ] Explain embedded containers

## Additional Resources

- [Spring Boot Reference Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Spring Guides](https://spring.io/guides)
- [Spring Boot GitHub](https://github.com/spring-projects/spring-boot)
- [Baeldung Spring Boot Tutorials](https://www.baeldung.com/spring-boot)

---

⬅️ Previous: [Table of Contents](./README.md)

➡️ Next: [Java Fundamentals](./02-java-fundamentals.md)