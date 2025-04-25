# Spring Boot DevTools 🛠️

## Overview

Master Spring Boot Developer Tools to enhance your development workflow. Learn about automatic restarts, live reload, remote debugging, and property defaults optimization.

## Core Concepts

### 1. DevTools Configuration

```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

```properties
# application.properties
spring.devtools.restart.enabled=true
spring.devtools.livereload.enabled=true
spring.devtools.restart.poll-interval=2s
spring.devtools.restart.quiet-period=1s
spring.devtools.restart.additional-paths=src/main/resources
spring.devtools.restart.exclude=static/**,public/**

# Remote DevTools (if needed)
spring.devtools.remote.secret=mysecret
spring.devtools.remote.debug=true
```

### 2. Custom Restart Trigger

```java
@Configuration
public class DevToolsConfig {
    @Bean
    public RestartTrigger customRestartTrigger() {
        return new CustomRestartTrigger();
    }
}

public class CustomRestartTrigger implements RestartTrigger {
    @Override
    public boolean isRestartRequired(File file) {
        return file.getName().endsWith(".properties") ||
               file.getName().endsWith(".yml");
    }
}
```

### 3. Remote Development Support

```java
@RestController
@Profile("dev")
public class DevToolsController {
    @GetMapping("/dev-info")
    public Map<String, Object> getDevInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("activeProfiles", environment.getActiveProfiles());
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("springBootVersion", SpringBootVersion.getVersion());
        return info;
    }
}
```

## Real-World Examples

### 1. Custom File Watcher

```java
@Component
public class CustomFileWatcher {
    private final FileSystemWatcher fileSystemWatcher;
    private final RestartStrategy restartStrategy;

    public CustomFileWatcher(RestartStrategy restartStrategy) {
        this.restartStrategy = restartStrategy;
        this.fileSystemWatcher = new FileSystemWatcher(true,
            Duration.ofMillis(500), Duration.ofMillis(100));

        configureWatcher();
    }

    private void configureWatcher() {
        fileSystemWatcher.addSourceDirectory(new File("src/main/resources/config"));
        fileSystemWatcher.addListener(new FileChangeListener() {
            @Override
            public void onChange(Set<ChangedFiles> changeSet) {
                for (ChangedFiles changedFiles : changeSet) {
                    for (ChangedFile changedFile : changedFiles) {
                        handleFileChange(changedFile);
                    }
                }
            }
        });
        fileSystemWatcher.start();
    }

    private void handleFileChange(ChangedFile changedFile) {
        if (changedFile.getType() == Type.MODIFY) {
            if (changedFile.getFile().getName().endsWith(".properties")) {
                restartStrategy.restart();
            }
        }
    }
}
```

### 2. Development Productivity Tools

```java
@Configuration
@Profile("dev")
public class DevProductivityConfig {
    @Bean
    public FilterRegistrationBean<DevToolsFilter> devToolsFilter() {
        FilterRegistrationBean<DevToolsFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new DevToolsFilter());
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    @Bean
    public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> devServerCustomizer() {
        return factory -> {
            factory.setPort(8080);
            factory.addInitializers(new DevToolsPropertyDefaultsPostProcessor());
        };
    }
}

@Component
@Profile("dev")
public class DevToolsFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {
        response.setHeader("X-Dev-Mode", "true");
        MDC.put("dev-mode", "true");
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("dev-mode");
        }
    }
}
```

### 3. Development Time Metrics

```java
@Configuration
@Profile("dev")
@EnableMetrics
public class DevMetricsConfig {
    @Bean
    public MeterRegistry devMeterRegistry() {
        CompositeMeterRegistry registry = new CompositeMeterRegistry();
        registry.add(new SimpleMeterRegistry());
        return registry;
    }

    @Bean
    public DevMetricsEndpoint devMetricsEndpoint(MeterRegistry meterRegistry) {
        return new DevMetricsEndpoint(meterRegistry);
    }
}

@Component
@Profile("dev")
public class DevMetricsEndpoint {
    private final MeterRegistry meterRegistry;
    private final Map<String, Timer> methodTimers = new ConcurrentHashMap<>();

    @Around("@annotation(org.springframework.web.bind.annotation.RequestMapping)")
    public Object timeEndpoint(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        return methodTimers.computeIfAbsent(methodName,
            k -> meterRegistry.timer("dev.endpoint.timer", "method", methodName))
            .record(() -> {
                try {
                    return joinPoint.proceed();
                } catch (Throwable t) {
                    throw new RuntimeException(t);
                }
            });
    }
}
```

## Common Pitfalls

1. ❌ Enabling DevTools in production
   ✅ Use proper profiles and dependencies

2. ❌ Excessive automatic restarts
   ✅ Configure restart triggers carefully

3. ❌ Security risks with remote DevTools
   ✅ Use secure secrets and proper network configuration

4. ❌ Memory leaks in development
   ✅ Monitor and manage development resources

## Best Practices

1. Configure restart exclusions properly
2. Use proper profiles for DevTools
3. Implement custom triggers when needed
4. Monitor development resources
5. Secure remote development
6. Optimize reload performance
7. Use LiveReload effectively
8. Implement proper logging

## Knowledge Check

- [ ] Configure DevTools in a project
- [ ] Implement custom restart triggers
- [ ] Set up remote development
- [ ] Configure LiveReload
- [ ] Implement development metrics
- [ ] Optimize restart performance

## Additional Resources

- [Spring Boot DevTools Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/using.html#using.devtools)
- [LiveReload Protocol](http://livereload.com/api/protocol/)
- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [Remote Development Guide](https://docs.spring.io/spring-boot/docs/current/reference/html/using.html#using.devtools.remote-applications)

---

⬅️ Previous: [Service Layer](./14-service-layer.md)

➡️ Next: [API Documentation](./16-api-docs.md)