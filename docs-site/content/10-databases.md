# Database Connectivity in Spring Boot 🗄️

## Overview

Master database connectivity in Spring Boot applications. Learn about database configuration, connection pooling, transaction management, and best practices for database operations.

## Core Concepts

### 1. Database Configuration

```properties
# application.properties
spring.datasource.url=jdbc:postgresql://localhost:5432/myapp
spring.datasource.username=myapp_user
spring.datasource.password=secret
spring.datasource.driver-class-name=org.postgresql.Driver

# Connection Pool Configuration
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.max-lifetime=1200000

# JPA Properties
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```

### 2. Database Configuration Class

```java
@Configuration
@EnableTransactionManagement
public class DatabaseConfig {
    @Bean
    @ConfigurationProperties("spring.datasource")
    public HikariConfig hikariConfig() {
        return new HikariConfig();
    }

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource(hikariConfig());
    }

    @Bean
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(
            EntityManagerFactoryBuilder builder,
            DataSource dataSource) {
        return builder
            .dataSource(dataSource)
            .packages("com.example.domain")
            .persistenceUnit("default")
            .properties(hibernateProperties())
            .build();
    }

    @Bean
    public PlatformTransactionManager transactionManager(
            EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }

    private Map<String, Object> hibernateProperties() {
        Map<String, Object> props = new HashMap<>();
        props.put("hibernate.physical_naming_strategy",
            "org.springframework.boot.orm.jpa.hibernate.SpringPhysicalNamingStrategy");
        props.put("hibernate.implicit_naming_strategy",
            "org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy");
        return props;
    }
}
```

### 3. Multiple Database Configuration

```java
@Configuration
@EnableTransactionManagement
public class MultipleDbConfig {
    @Primary
    @Bean(name = "primaryDataSource")
    @ConfigurationProperties("spring.datasource.primary")
    public DataSource primaryDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "secondaryDataSource")
    @ConfigurationProperties("spring.datasource.secondary")
    public DataSource secondaryDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Primary
    @Bean(name = "primaryEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean primaryEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("primaryDataSource") DataSource dataSource) {
        return builder
            .dataSource(dataSource)
            .packages("com.example.primary.domain")
            .persistenceUnit("primary")
            .build();
    }

    @Bean(name = "secondaryEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean secondaryEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("secondaryDataSource") DataSource dataSource) {
        return builder
            .dataSource(dataSource)
            .packages("com.example.secondary.domain")
            .persistenceUnit("secondary")
            .build();
    }

    @Primary
    @Bean(name = "primaryTransactionManager")
    public PlatformTransactionManager primaryTransactionManager(
            @Qualifier("primaryEntityManagerFactory") EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }

    @Bean(name = "secondaryTransactionManager")
    public PlatformTransactionManager secondaryTransactionManager(
            @Qualifier("secondaryEntityManagerFactory") EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }
}
```

## Real-World Examples

### 1. Database Health Check Service

```java
@Service
@Slf4j
public class DatabaseHealthService {
    private final DataSource dataSource;
    private final EntityManager entityManager;

    public boolean checkDatabaseConnection() {
        try (Connection conn = dataSource.getConnection()) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SELECT 1");
                return true;
            }
        } catch (SQLException e) {
            log.error("Database connection check failed", e);
            return false;
        }
    }

    public Map<String, Object> getDatabaseMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        try {
            // Get connection pool metrics
            if (dataSource instanceof HikariDataSource) {
                HikariDataSource hikariDS = (HikariDataSource) dataSource;
                HikariPoolMXBean poolMXBean = hikariDS.getHikariPoolMXBean();

                metrics.put("active_connections", poolMXBean.getActiveConnections());
                metrics.put("idle_connections", poolMXBean.getIdleConnections());
                metrics.put("total_connections", poolMXBean.getTotalConnections());
                metrics.put("threads_awaiting_connection", poolMXBean.getThreadsAwaitingConnection());
            }

            // Get database version
            try (Connection conn = dataSource.getConnection()) {
                metrics.put("database_version", conn.getMetaData().getDatabaseProductVersion());
            }

            // Get entity statistics
            SessionFactory sessionFactory = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class);
            Statistics stats = sessionFactory.getStatistics();

            metrics.put("session_open_count", stats.getSessionOpenCount());
            metrics.put("transaction_count", stats.getTransactionCount());
            metrics.put("successful_transaction_count", stats.getSuccessfulTransactionCount());
            metrics.put("query_execution_count", stats.getQueryExecutionCount());

        } catch (Exception e) {
            log.error("Error collecting database metrics", e);
        }

        return metrics;
    }
}
```

### 2. Database Migration Service

```java
@Service
@Slf4j
public class DatabaseMigrationService {
    private final Flyway flyway;
    private final DataSource dataSource;

    public void migrateDatabase() {
        try {
            log.info("Starting database migration");
            flyway.migrate();
            log.info("Database migration completed successfully");
        } catch (FlywayException e) {
            log.error("Database migration failed", e);
            throw new DatabaseMigrationException("Failed to migrate database", e);
        }
    }

    public void validateMigrations() {
        try {
            log.info("Validating database migrations");
            flyway.validate();
            log.info("Database migrations are valid");
        } catch (FlywayException e) {
            log.error("Database migration validation failed", e);
            throw new DatabaseMigrationException("Invalid database migrations", e);
        }
    }

    public MigrationInfo[] getMigrationInfo() {
        return flyway.info().all();
    }

    public void repair() {
        try {
            log.info("Repairing database migrations");
            flyway.repair();
            log.info("Database migration repair completed");
        } catch (FlywayException e) {
            log.error("Database migration repair failed", e);
            throw new DatabaseMigrationException("Failed to repair database migrations", e);
        }
    }
}
```

### 3. Database Backup Service

```java
@Service
@Slf4j
public class DatabaseBackupService {
    private final DataSource dataSource;
    private final Path backupDirectory;

    @Value("${backup.retention.days:30}")
    private int backupRetentionDays;

    @Scheduled(cron = "0 0 2 * * ?") // Run at 2 AM daily
    public void performBackup() {
        try {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            Path backupFile = backupDirectory.resolve("backup_" + timestamp + ".sql");

            ProcessBuilder pb = new ProcessBuilder(
                "pg_dump",
                "-h", getHost(),
                "-U", getUsername(),
                "-d", getDatabaseName(),
                "-f", backupFile.toString()
            );

            pb.environment().put("PGPASSWORD", getPassword());
            Process process = pb.start();

            if (process.waitFor() == 0) {
                log.info("Database backup completed successfully: {}", backupFile);
                cleanupOldBackups();
            } else {
                log.error("Database backup failed");
                throw new DatabaseBackupException("Backup process returned non-zero exit code");
            }
        } catch (Exception e) {
            log.error("Error performing database backup", e);
            throw new DatabaseBackupException("Failed to backup database", e);
        }
    }

    private void cleanupOldBackups() {
        try {
            LocalDateTime cutoffDate = LocalDateTime.now().minusDays(backupRetentionDays);

            Files.list(backupDirectory)
                .filter(path -> path.toString().endsWith(".sql"))
                .filter(path -> {
                    try {
                        BasicFileAttributes attrs = Files.readAttributes(
                            path, BasicFileAttributes.class);
                        return attrs.creationTime().toInstant()
                            .isBefore(cutoffDate.toInstant(ZoneOffset.UTC));
                    } catch (IOException e) {
                        return false;
                    }
                })
                .forEach(path -> {
                    try {
                        Files.delete(path);
                        log.info("Deleted old backup: {}", path);
                    } catch (IOException e) {
                        log.error("Failed to delete old backup: {}", path, e);
                    }
                });
        } catch (IOException e) {
            log.error("Error cleaning up old backups", e);
        }
    }
}
```

## Common Pitfalls

1. ❌ Not configuring connection pool properly
   ✅ Use appropriate pool settings

2. ❌ Missing transaction management
   ✅ Use proper transaction boundaries

3. ❌ Poor error handling
   ✅ Implement comprehensive error handling

4. ❌ Connection leaks
   ✅ Always close connections properly

## Best Practices

1. Use connection pooling
2. Configure transaction management
3. Implement database migrations
4. Monitor database health
5. Regular backups
6. Use prepared statements
7. Implement retry mechanisms
8. Configure timeouts

## Knowledge Check

- [ ] Configure database connection
- [ ] Set up connection pool
- [ ] Implement transactions
- [ ] Handle multiple databases
- [ ] Implement database migrations
- [ ] Configure database monitoring

## Additional Resources

- [Spring Boot Database Guide](https://docs.spring.io/spring-boot/docs/current/reference/html/data.html)
- [HikariCP Documentation](https://github.com/brettwooldridge/HikariCP)
- [Flyway Documentation](https://flywaydb.org/documentation/)
- [Spring Transaction Management](https://docs.spring.io/spring-framework/docs/current/reference/html/data-access.html#transaction)

---

⬅️ Previous: [Spring Data JPA](./09-spring-data-jpa.md)

➡️ Next: [Entity Relationships](./11-entity-relationships.md)