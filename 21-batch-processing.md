# Batch Processing in Spring Boot 🔄

## Overview

Master batch processing in Spring Boot applications. Learn about Spring Batch configuration, job processing, chunk processing, and best practices for efficient batch operations.

## Core Concepts

### 1. Batch Configuration

```java
@Configuration
@EnableBatchProcessing
public class BatchConfig {
    private final JobBuilderFactory jobBuilderFactory;
    private final StepBuilderFactory stepBuilderFactory;
    private final DataSource dataSource;

    @Bean
    public JdbcTemplate jdbcTemplate() {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public JobRepository jobRepository() throws Exception {
        JobRepositoryFactoryBean factory = new JobRepositoryFactoryBean();
        factory.setDataSource(dataSource);
        factory.setTransactionManager(new DataSourceTransactionManager(dataSource));
        factory.setIsolationLevelForCreate("ISOLATION_SERIALIZABLE");
        factory.setTablePrefix("BATCH_");
        factory.setMaxVarCharLength(1000);
        return factory.getObject();
    }

    @Bean
    public SimpleJobLauncher jobLauncher() throws Exception {
        SimpleJobLauncher launcher = new SimpleJobLauncher();
        launcher.setJobRepository(jobRepository());
        launcher.setTaskExecutor(new SimpleAsyncTaskExecutor());
        return launcher;
    }

    @Bean
    public JobRegistryBeanPostProcessor jobRegistryBeanPostProcessor(JobRegistry jobRegistry) {
        JobRegistryBeanPostProcessor postProcessor = new JobRegistryBeanPostProcessor();
        postProcessor.setJobRegistry(jobRegistry);
        return postProcessor;
    }
}
```

### 2. Job Configuration

```java
@Configuration
@Slf4j
public class DataMigrationJobConfig {
    private final JobBuilderFactory jobBuilderFactory;
    private final StepBuilderFactory stepBuilderFactory;
    private final EntityManagerFactory entityManagerFactory;

    @Bean
    public Job dataMigrationJob(
            Step migrationStep,
            JobCompletionNotificationListener listener) {
        return jobBuilderFactory.get("dataMigrationJob")
            .incrementer(new RunIdIncrementer())
            .listener(listener)
            .flow(migrationStep)
            .end()
            .build();
    }

    @Bean
    public Step migrationStep(
            ItemReader<LegacyCustomer> reader,
            ItemProcessor<LegacyCustomer, Customer> processor,
            ItemWriter<Customer> writer) {
        return stepBuilderFactory.get("migrationStep")
            .<LegacyCustomer, Customer>chunk(100)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .faultTolerant()
            .retry(Exception.class)
            .retryLimit(3)
            .skip(Exception.class)
            .skipLimit(10)
            .listener(new StepExecutionListener() {
                @Override
                public void beforeStep(StepExecution stepExecution) {
                    log.info("Starting step: {}", stepExecution.getStepName());
                }

                @Override
                public ExitStatus afterStep(StepExecution stepExecution) {
                    log.info("Step complete: {} with status: {}",
                        stepExecution.getStepName(),
                        stepExecution.getStatus());
                    return stepExecution.getExitStatus();
                }
            })
            .build();
    }

    @Bean
    @StepScope
    public JpaPagingItemReader<LegacyCustomer> reader() {
        return new JpaPagingItemReaderBuilder<LegacyCustomer>()
            .name("legacyCustomerReader")
            .entityManagerFactory(entityManagerFactory)
            .pageSize(100)
            .queryString("SELECT c FROM LegacyCustomer c")
            .build();
    }

    @Bean
    @StepScope
    public ItemProcessor<LegacyCustomer, Customer> processor() {
        return new LegacyCustomerProcessor();
    }

    @Bean
    @StepScope
    public JpaItemWriter<Customer> writer() {
        JpaItemWriter<Customer> writer = new JpaItemWriter<>();
        writer.setEntityManagerFactory(entityManagerFactory);
        return writer;
    }
}
```

### 3. Job Execution Service

```java
@Service
@Slf4j
public class BatchJobService {
    private final JobLauncher jobLauncher;
    private final JobRegistry jobRegistry;
    private final JobExplorer jobExplorer;
    private final JobRepository jobRepository;

    public JobExecution runJob(String jobName, JobParameters jobParameters) throws Exception {
        Job job = jobRegistry.getJob(jobName);
        return jobLauncher.run(job, jobParameters);
    }

    public JobExecution restartJob(Long jobExecutionId) throws Exception {
        JobExecution jobExecution = jobExplorer.getJobExecution(jobExecutionId);
        if (jobExecution == null) {
            throw new JobExecutionNotFoundError("No job execution found with id: " + jobExecutionId);
        }

        JobInstance jobInstance = jobExecution.getJobInstance();
        Job job = jobRegistry.getJob(jobInstance.getJobName());

        JobParameters jobParameters = jobExecution.getJobParameters();
        jobRepository.update(jobExecution);

        return jobLauncher.run(job, jobParameters);
    }

    public void stopJob(Long jobExecutionId) throws Exception {
        JobExecution jobExecution = jobExplorer.getJobExecution(jobExecutionId);
        if (jobExecution != null && jobExecution.isRunning()) {
            jobExecution.stop();
            jobRepository.update(jobExecution);
        }
    }

    public JobExecutionStatus getJobStatus(Long jobExecutionId) {
        JobExecution jobExecution = jobExplorer.getJobExecution(jobExecutionId);
        if (jobExecution == null) {
            throw new JobExecutionNotFoundError("No job execution found with id: " + jobExecutionId);
        }

        return new JobExecutionStatus(
            jobExecution.getStatus(),
            jobExecution.getExitStatus(),
            jobExecution.getStartTime(),
            jobExecution.getEndTime(),
            jobExecution.getFailureExceptions()
        );
    }
}
```

## Real-World Examples

### 1. Data Migration Job

```java
@Component
@Slf4j
public class LegacyCustomerProcessor implements ItemProcessor<LegacyCustomer, Customer> {
    private final CustomerEnricher customerEnricher;
    private final CustomerValidator customerValidator;

    @Override
    public Customer process(LegacyCustomer legacyCustomer) throws Exception {
        try {
            // Transform legacy customer to new format
            Customer customer = transformCustomer(legacyCustomer);

            // Enrich customer data
            customer = customerEnricher.enrich(customer);

            // Validate customer
            if (!customerValidator.isValid(customer)) {
                log.warn("Invalid customer data: {}", legacyCustomer.getId());
                return null; // Skip invalid customers
            }

            return customer;
        } catch (Exception e) {
            log.error("Error processing customer: {}", legacyCustomer.getId(), e);
            throw e;
        }
    }

    private Customer transformCustomer(LegacyCustomer legacyCustomer) {
        Customer customer = new Customer();
        customer.setExternalId(legacyCustomer.getId());
        customer.setFirstName(legacyCustomer.getFirstName());
        customer.setLastName(legacyCustomer.getLastName());
        customer.setEmail(legacyCustomer.getEmail().toLowerCase());
        customer.setStatus(mapCustomerStatus(legacyCustomer.getStatus()));
        customer.setCreatedAt(legacyCustomer.getCreationDate());
        return customer;
    }

    private CustomerStatus mapCustomerStatus(String legacyStatus) {
        return switch (legacyStatus.toUpperCase()) {
            case "A" -> CustomerStatus.ACTIVE;
            case "I" -> CustomerStatus.INACTIVE;
            case "P" -> CustomerStatus.PENDING;
            default -> CustomerStatus.UNKNOWN;
        };
    }
}

@Component
public class JobCompletionNotificationListener implements JobExecutionListener {
    private final NotificationService notificationService;
    private final MetricsService metricsService;

    @Override
    public void beforeJob(JobExecution jobExecution) {
        log.info("Job started: {}", jobExecution.getJobInstance().getJobName());
        metricsService.recordJobStart(jobExecution);
    }

    @Override
    public void afterJob(JobExecution jobExecution) {
        if (jobExecution.getStatus() == BatchStatus.COMPLETED) {
            log.info("Job completed successfully");
            notificationService.notifyJobSuccess(jobExecution);
        } else {
            log.error("Job failed with status: {}", jobExecution.getStatus());
            notificationService.notifyJobFailure(jobExecution);
        }

        metricsService.recordJobCompletion(jobExecution);
    }
}
```

### 2. Report Generation Job

```java
@Configuration
@Slf4j
public class ReportGenerationJobConfig {
    private final JobBuilderFactory jobBuilderFactory;
    private final StepBuilderFactory stepBuilderFactory;
    private final DataSource dataSource;

    @Bean
    public Job reportGenerationJob(
            Step dataExtractionStep,
            Step reportGenerationStep,
            Step reportDistributionStep) {
        return jobBuilderFactory.get("reportGenerationJob")
            .incrementer(new RunIdIncrementer())
            .start(dataExtractionStep)
            .next(reportGenerationStep)
            .next(reportDistributionStep)
            .build();
    }

    @Bean
    public Step dataExtractionStep(
            ItemReader<Transaction> reader,
            ItemProcessor<Transaction, ReportData> processor,
            ItemWriter<ReportData> writer) {
        return stepBuilderFactory.get("dataExtractionStep")
            .<Transaction, ReportData>chunk(100)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .build();
    }

    @Bean
    public Step reportGenerationStep() {
        return stepBuilderFactory.get("reportGenerationStep")
            .tasklet((contribution, chunkContext) -> {
                generateReport(chunkContext.getStepContext());
                return RepeatStatus.FINISHED;
            })
            .build();
    }

    @Bean
    public Step reportDistributionStep() {
        return stepBuilderFactory.get("reportDistributionStep")
            .tasklet((contribution, chunkContext) -> {
                distributeReport(chunkContext.getStepContext());
                return RepeatStatus.FINISHED;
            })
            .build();
    }

    private void generateReport(StepContext stepContext) {
        // Implementation of report generation logic
    }

    private void distributeReport(StepContext stepContext) {
        // Implementation of report distribution logic
    }
}
```

### 3. Scheduled Batch Job

```java
@Configuration
@EnableScheduling
@Slf4j
public class ScheduledBatchJobConfig {
    private final JobLauncher jobLauncher;
    private final Job dataCleanupJob;

    @Scheduled(cron = "0 0 1 * * ?") // Run at 1 AM every day
    public void runDataCleanupJob() {
        try {
            JobParameters jobParameters = new JobParametersBuilder()
                .addDate("date", new Date())
                .toJobParameters();

            JobExecution jobExecution = jobLauncher.run(dataCleanupJob, jobParameters);
            log.info("Data cleanup job completed with status: {}", jobExecution.getStatus());
        } catch (Exception e) {
            log.error("Error running data cleanup job", e);
        }
    }

    @Bean
    public Job dataCleanupJob(Step cleanupStep) {
        return jobBuilderFactory.get("dataCleanupJob")
            .incrementer(new RunIdIncrementer())
            .flow(cleanupStep)
            .end()
            .build();
    }

    @Bean
    public Step cleanupStep(
            ItemReader<StaleData> reader,
            ItemProcessor<StaleData, StaleData> processor,
            ItemWriter<StaleData> writer) {
        return stepBuilderFactory.get("cleanupStep")
            .<StaleData, StaleData>chunk(100)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .build();
    }

    @Bean
    @StepScope
    public ItemReader<StaleData> staleDataReader(
            @Value("#{jobParameters['date']}") Date date) {
        JdbcCursorItemReader<StaleData> reader = new JdbcCursorItemReader<>();
        reader.setDataSource(dataSource);
        reader.setSql("SELECT * FROM stale_data WHERE created_at < ?");
        reader.setPreparedStatementSetter(ps -> ps.setDate(1, new java.sql.Date(date.getTime())));
        reader.setRowMapper(new StaleDataRowMapper());
        return reader;
    }
}
```

## Common Pitfalls

1. ❌ Not handling restarts
   ✅ Implement restart capability

2. ❌ Poor error handling
   ✅ Implement proper error handling and skips

3. ❌ Missing monitoring
   ✅ Implement job monitoring

4. ❌ Resource leaks
   ✅ Properly manage resources

## Best Practices

1. Use chunk processing
2. Implement proper error handling
3. Enable job restart capability
4. Monitor job execution
5. Use appropriate batch size
6. Implement idempotency
7. Handle transactions properly
8. Use step-scoped beans

## Knowledge Check

- [ ] Configure batch jobs
- [ ] Implement item readers
- [ ] Implement item processors
- [ ] Implement item writers
- [ ] Handle job restarts
- [ ] Monitor batch execution

## Additional Resources

- [Spring Batch Documentation](https://docs.spring.io/spring-batch/docs/current/reference/html/)
- [Spring Batch Examples](https://github.com/spring-projects/spring-batch/tree/main/spring-batch-samples)
- [Spring Batch Testing](https://docs.spring.io/spring-batch/docs/current/reference/html/testing.html)
- [Spring Batch Best Practices](https://docs.spring.io/spring-batch/docs/current/reference/html/common-patterns.html)

---

⬅️ Previous: [Messaging](./20-messaging.md)

➡️ Next: [Scheduling](./22-scheduling.md)