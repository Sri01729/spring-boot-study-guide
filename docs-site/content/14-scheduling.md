# Scheduling in Spring Boot ⏰

## Overview

Master task scheduling in Spring Boot applications. Learn about fixed-rate execution, cron expressions, dynamic scheduling, and asynchronous task execution.

## Core Concepts

### 1. Basic Scheduling Configuration

```java
@Configuration
@EnableScheduling
@Slf4j
public class SchedulingConfig {
    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("scheduled-task-");
        scheduler.setErrorHandler(t -> log.error("Error in scheduled task", t));
        scheduler.setRejectedExecutionHandler((r, e) -> log.error("Task rejected", e));
        return scheduler;
    }

    @Bean
    public ScheduledAnnotationBeanPostProcessor scheduledAnnotationProcessor() {
        return new ScheduledAnnotationBeanPostProcessor();
    }
}
```

### 2. Dynamic Scheduling Service

```java
@Service
@Slf4j
public class DynamicSchedulingService {
    private final TaskScheduler taskScheduler;
    private final ConcurrentHashMap<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    private final TaskDefinitionRepository taskDefinitionRepository;

    public void scheduleTask(String taskId, Runnable task, String cronExpression) {
        ScheduledFuture<?> scheduledTask = taskScheduler.schedule(
            () -> {
                try {
                    task.run();
                } catch (Exception e) {
                    log.error("Error executing task: {}", taskId, e);
                }
            },
            new CronTrigger(cronExpression)
        );

        ScheduledFuture<?> existingTask = scheduledTasks.put(taskId, scheduledTask);
        if (existingTask != null) {
            existingTask.cancel(false);
        }

        log.info("Scheduled task: {} with cron: {}", taskId, cronExpression);
    }

    public void cancelTask(String taskId) {
        ScheduledFuture<?> scheduledTask = scheduledTasks.remove(taskId);
        if (scheduledTask != null) {
            scheduledTask.cancel(false);
            log.info("Cancelled task: {}", taskId);
        }
    }

    public void updateTaskSchedule(String taskId, String newCronExpression) {
        TaskDefinition taskDef = taskDefinitionRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException(taskId));

        scheduleTask(taskId, taskDef.getTask(), newCronExpression);
        log.info("Updated schedule for task: {} to cron: {}", taskId, newCronExpression);
    }

    public Map<String, TaskStatus> getTaskStatuses() {
        Map<String, TaskStatus> statuses = new HashMap<>();
        scheduledTasks.forEach((taskId, future) -> {
            TaskStatus status = new TaskStatus(
                taskId,
                !future.isCancelled() && !future.isDone(),
                future.getDelay(TimeUnit.MILLISECONDS)
            );
            statuses.put(taskId, status);
        });
        return statuses;
    }

    @PostConstruct
    public void initScheduledTasks() {
        taskDefinitionRepository.findAll().forEach(taskDef ->
            scheduleTask(taskDef.getId(), taskDef.getTask(), taskDef.getCronExpression())
        );
    }
}
```

### 3. Async Scheduling Configuration

```java
@Configuration
@EnableAsync
@Slf4j
public class AsyncSchedulingConfig {
    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("async-task-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        return executor;
    }

    @Bean
    public AsyncUncaughtExceptionHandler asyncExceptionHandler() {
        return new SimpleAsyncUncaughtExceptionHandler();
    }
}
```

## Real-World Examples

### 1. Report Scheduler Service

```java
@Service
@Slf4j
public class ReportSchedulerService {
    private final ReportGenerator reportGenerator;
    private final EmailService emailService;
    private final MetricsService metricsService;

    @Scheduled(cron = "0 0 6 * * MON-FRI") // Weekdays at 6 AM
    @SchedulerLock(name = "generateDailyReport")
    public void generateDailyReport() {
        try {
            log.info("Starting daily report generation");
            metricsService.recordScheduledTaskStart("daily-report");

            Report report = reportGenerator.generateDailyReport();
            emailService.sendReport(report, "daily-report-recipients");

            metricsService.recordScheduledTaskSuccess("daily-report");
            log.info("Completed daily report generation");
        } catch (Exception e) {
            metricsService.recordScheduledTaskError("daily-report");
            log.error("Error generating daily report", e);
            throw e;
        }
    }

    @Scheduled(cron = "0 0 7 ? * MON") // Mondays at 7 AM
    @SchedulerLock(name = "generateWeeklyReport")
    public void generateWeeklyReport() {
        try {
            log.info("Starting weekly report generation");
            metricsService.recordScheduledTaskStart("weekly-report");

            Report report = reportGenerator.generateWeeklyReport();
            emailService.sendReport(report, "weekly-report-recipients");

            metricsService.recordScheduledTaskSuccess("weekly-report");
            log.info("Completed weekly report generation");
        } catch (Exception e) {
            metricsService.recordScheduledTaskError("weekly-report");
            log.error("Error generating weekly report", e);
            throw e;
        }
    }
}
```

### 2. Health Check Scheduler

```java
@Service
@Slf4j
public class HealthCheckScheduler {
    private final HealthCheckService healthCheckService;
    private final AlertService alertService;
    private final MetricsService metricsService;

    @Async
    @Scheduled(fixedRate = 60000) // Every minute
    @SchedulerLock(name = "performHealthChecks")
    public void performHealthChecks() {
        try {
            log.debug("Starting health checks");
            List<HealthCheckResult> results = healthCheckService.checkAllEndpoints();

            results.stream()
                .filter(result -> !result.isHealthy())
                .forEach(result -> {
                    alertService.sendAlert(
                        String.format("Endpoint %s is unhealthy: %s",
                            result.getEndpoint(),
                            result.getMessage()
                        )
                    );
                    metricsService.recordUnhealthyEndpoint(result.getEndpoint());
                });

            double healthyPercentage = calculateHealthyPercentage(results);
            metricsService.recordHealthCheckResults(healthyPercentage);

            log.info("Health checks completed. Healthy: {}%", healthyPercentage);
        } catch (Exception e) {
            log.error("Error performing health checks", e);
            alertService.sendAlert("Health check system failure: " + e.getMessage());
            throw e;
        }
    }

    private double calculateHealthyPercentage(List<HealthCheckResult> results) {
        if (results.isEmpty()) return 0.0;
        long healthyCount = results.stream().filter(HealthCheckResult::isHealthy).count();
        return (double) healthyCount / results.size() * 100.0;
    }
}
```

### 3. Data Cleanup Service

```java
@Service
@Slf4j
public class DataCleanupService {
    private final DataRepository dataRepository;
    private final FileService fileService;
    private final MetricsService metricsService;

    @Scheduled(cron = "0 0 2 * * ?") // Every day at 2 AM
    @SchedulerLock(name = "cleanupStaleData")
    public void cleanupStaleData() {
        try {
            log.info("Starting stale data cleanup");
            metricsService.recordScheduledTaskStart("data-cleanup");

            LocalDateTime cutoffDate = LocalDateTime.now().minusDays(30);
            int deletedRecords = dataRepository.deleteStaleData(cutoffDate);
            int deletedFiles = fileService.deleteStaleFiles(cutoffDate);

            metricsService.recordDataCleanup(deletedRecords, deletedFiles);
            log.info("Completed data cleanup. Deleted {} records and {} files",
                deletedRecords, deletedFiles);
        } catch (Exception e) {
            metricsService.recordScheduledTaskError("data-cleanup");
            log.error("Error during data cleanup", e);
            throw e;
        }
    }

    @Scheduled(cron = "0 0 3 * * SUN") // Every Sunday at 3 AM
    @SchedulerLock(name = "performDatabaseMaintenance")
    public void performDatabaseMaintenance() {
        try {
            log.info("Starting database maintenance");
            metricsService.recordScheduledTaskStart("db-maintenance");

            dataRepository.vacuum();
            dataRepository.reindex();

            metricsService.recordScheduledTaskSuccess("db-maintenance");
            log.info("Completed database maintenance");
        } catch (Exception e) {
            metricsService.recordScheduledTaskError("db-maintenance");
            log.error("Error during database maintenance", e);
            throw e;
        }
    }
}
```

## Common Pitfalls

1. ❌ Not handling concurrent execution
   ✅ Use @SchedulerLock or proper synchronization

2. ❌ Missing error handling
   ✅ Implement comprehensive error handling

3. ❌ Poor monitoring
   ✅ Add proper logging and metrics

4. ❌ Resource exhaustion
   ✅ Configure appropriate thread pools

## Best Practices

1. Use appropriate thread pools
2. Implement proper error handling
3. Add monitoring and metrics
4. Use scheduler locks for distributed systems
5. Configure task timeouts
6. Implement graceful shutdown
7. Use appropriate scheduling intervals
8. Add proper logging

## Knowledge Check

- [ ] Configure basic scheduling
- [ ] Implement dynamic scheduling
- [ ] Handle concurrent execution
- [ ] Implement error handling
- [ ] Add monitoring
- [ ] Use scheduler locks

## Additional Resources

- [Spring Task Execution and Scheduling](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#scheduling)
- [Spring @Scheduled Annotation](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/Scheduled.html)
- [Shedlock Documentation](https://github.com/lukas-krecan/ShedLock)
- [Spring @Async Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#scheduling-annotation-support-async)

---

⬅️ Previous: [Performance](./13-performance.md)

➡️ Next: [Validation](./15-validation.md)