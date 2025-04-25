# Spring Boot Scheduling ⏰

## Overview

Master task scheduling in Spring Boot applications. Learn about fixed-rate execution, cron jobs, dynamic scheduling, and asynchronous task execution.

## Core Concepts

### 1. Basic Scheduling Configuration

```java
@Configuration
@EnableScheduling
public class SchedulingConfig {
    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("TaskScheduler-");
        scheduler.setErrorHandler(throwable ->
            log.error("Scheduled task error", throwable));
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(60);
        return scheduler;
    }
}

@Component
@Slf4j
public class ScheduledTasks {
    @Scheduled(fixedRate = 60000) // Every minute
    public void reportCurrentTime() {
        log.info("Current time is: {}", LocalDateTime.now());
    }

    @Scheduled(fixedDelay = 30000) // 30 seconds after previous task completes
    public void processQueue() {
        log.info("Processing message queue");
    }

    @Scheduled(initialDelay = 10000, fixedRate = 300000) // Start after 10s, then every 5 min
    public void cleanupTask() {
        log.info("Running cleanup task");
    }

    @Scheduled(cron = "0 0 2 * * *") // Every day at 2 AM
    public void nightlyBackup() {
        log.info("Starting nightly backup");
    }
}
```

### 2. Dynamic Scheduling

```java
@Service
@Slf4j
public class DynamicSchedulingService {
    private final ScheduledTaskRegistrar taskRegistrar;
    private final Map<String, ScheduledTask> scheduledTasks = new ConcurrentHashMap<>();

    public void scheduleTask(String taskId, String cronExpression, Runnable task) {
        CronTrigger trigger = new CronTrigger(cronExpression);
        ScheduledTask scheduledTask = taskRegistrar.scheduleCronTask(
            new CronTask(task, trigger));

        scheduledTasks.put(taskId, scheduledTask);
        log.info("Scheduled task {} with cron {}", taskId, cronExpression);
    }

    public void cancelTask(String taskId) {
        ScheduledTask scheduledTask = scheduledTasks.get(taskId);
        if (scheduledTask != null) {
            scheduledTask.cancel();
            scheduledTasks.remove(taskId);
            log.info("Cancelled task {}", taskId);
        }
    }

    public void updateTask(String taskId, String newCronExpression) {
        cancelTask(taskId);
        scheduleTask(taskId, newCronExpression,
            scheduledTasks.get(taskId).getTask().getRunnable());
        log.info("Updated task {} with new cron {}", taskId, newCronExpression);
    }
}
```

### 3. Async Scheduled Tasks

```java
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncSchedulingConfig {
    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("AsyncTask-");
        executor.initialize();
        return executor;
    }
}

@Component
@Slf4j
public class AsyncScheduledTasks {
    @Async
    @Scheduled(fixedRate = 60000)
    public CompletableFuture<Void> asyncTask() {
        return CompletableFuture.runAsync(() -> {
            log.info("Starting async task");
            try {
                // Simulate long-running task
                Thread.sleep(5000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            log.info("Completed async task");
        });
    }
}
```

## Real-World Examples

### 1. Report Generation Service

```java
@Service
@Slf4j
public class ReportSchedulerService {
    private final ReportGenerator reportGenerator;
    private final EmailService emailService;
    private final TaskScheduler taskScheduler;

    @Scheduled(cron = "0 0 6 * * MON-FRI") // Weekdays at 6 AM
    public void generateDailyReport() {
        log.info("Starting daily report generation");
        try {
            Report report = reportGenerator.generateDailyReport();
            emailService.sendReport("daily-report@company.com", report);
            log.info("Daily report sent successfully");
        } catch (Exception e) {
            log.error("Failed to generate/send daily report", e);
            notifyAdmins("Daily Report Failed", e.getMessage());
        }
    }

    @Scheduled(cron = "0 0 1 * * MON") // Every Monday at 1 AM
    @SchedulerLock(name = "weeklyReport")
    public void generateWeeklyReport() {
        log.info("Starting weekly report generation");
        try {
            Report report = reportGenerator.generateWeeklyReport();
            emailService.sendReport("weekly-report@company.com", report);
            log.info("Weekly report sent successfully");
        } catch (Exception e) {
            log.error("Failed to generate/send weekly report", e);
            notifyAdmins("Weekly Report Failed", e.getMessage());
        }
    }
}
```

### 2. Data Cleanup Service

```java
@Service
@Slf4j
public class DataCleanupService {
    private final UserRepository userRepository;
    private final FileService fileService;
    private final MetricsService metricsService;

    @Scheduled(cron = "0 0 3 * * *") // Every day at 3 AM
    @Transactional
    public void cleanupInactiveUsers() {
        log.info("Starting inactive users cleanup");
        LocalDateTime cutoffDate = LocalDateTime.now().minusMonths(6);

        try {
            List<User> inactiveUsers = userRepository
                .findByLastLoginBefore(cutoffDate);

            inactiveUsers.forEach(user -> {
                log.info("Archiving inactive user: {}", user.getId());
                archiveUserData(user);
                user.setStatus(UserStatus.ARCHIVED);
            });

            userRepository.saveAll(inactiveUsers);
            metricsService.recordCleanup("users", inactiveUsers.size());
        } catch (Exception e) {
            log.error("Error during user cleanup", e);
            notifyAdmins("User Cleanup Failed", e.getMessage());
        }
    }

    @Scheduled(cron = "0 0 4 * * *") // Every day at 4 AM
    public void cleanupTempFiles() {
        log.info("Starting temporary files cleanup");
        try {
            int deletedFiles = fileService.cleanupTempFiles();
            log.info("Deleted {} temporary files", deletedFiles);
            metricsService.recordCleanup("files", deletedFiles);
        } catch (Exception e) {
            log.error("Error during file cleanup", e);
            notifyAdmins("File Cleanup Failed", e.getMessage());
        }
    }
}
```

### 3. Health Check Scheduler

```java
@Service
@Slf4j
public class HealthCheckScheduler {
    private final WebClient webClient;
    private final AlertService alertService;
    private final MetricsService metricsService;
    private final DynamicSchedulingService scheduler;

    @PostConstruct
    public void initializeHealthChecks() {
        scheduler.scheduleTask(
            "api-health-check",
            "*/5 * * * * *", // Every 5 seconds
            () -> checkEndpoint("API", "https://api.example.com/health")
        );

        scheduler.scheduleTask(
            "db-health-check",
            "*/30 * * * * *", // Every 30 seconds
            () -> checkEndpoint("Database", "https://db.example.com/health")
        );
    }

    private void checkEndpoint(String service, String url) {
        try {
            long startTime = System.currentTimeMillis();
            webClient.get()
                .uri(url)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(5));

            long responseTime = System.currentTimeMillis() - startTime;
            metricsService.recordHealthCheck(service, true, responseTime);

            if (responseTime > 1000) {
                alertService.sendAlert(
                    String.format("%s high latency: %dms", service, responseTime));
            }
        } catch (Exception e) {
            log.error("{} health check failed", service, e);
            metricsService.recordHealthCheck(service, false, 0);
            alertService.sendAlert(
                String.format("%s is down: %s", service, e.getMessage()));
        }
    }
}
```

## Common Pitfalls

1. ❌ Not handling task exceptions
   ✅ Use error handlers and proper logging

2. ❌ Overlapping task execution
   ✅ Use @SchedulerLock for distributed systems

3. ❌ Resource exhaustion
   ✅ Configure appropriate thread pools

4. ❌ Hard-coded schedules
   ✅ Use configurable scheduling

## Best Practices

1. Configure thread pools appropriately
2. Handle task exceptions
3. Use async tasks when needed
4. Monitor task execution
5. Implement proper error handling
6. Use distributed locks
7. Make schedules configurable
8. Log task execution details

## Knowledge Check

- [ ] Configure basic scheduling
- [ ] Implement dynamic scheduling
- [ ] Create async scheduled tasks
- [ ] Handle task exceptions
- [ ] Monitor task execution
- [ ] Implement distributed locks

## Additional Resources

- [Spring Task Execution and Scheduling](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#scheduling)
- [Spring Scheduled Tasks](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#scheduling-annotation-support)
- [Cron Expression Generator](https://www.cronmaker.com/)
- [ShedLock Documentation](https://github.com/lukas-krecan/ShedLock)

---

⬅️ Previous: [Validation](./25-validation.md)

➡️ Next: [File Operations](./26-file-operations.md)