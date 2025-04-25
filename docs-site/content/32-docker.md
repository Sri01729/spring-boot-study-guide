# Docker with Spring Boot 🐳

## Overview

Master containerization of Spring Boot applications with Docker. Learn about Docker concepts, best practices, and deployment strategies.

## Core Concepts

### 1. Dockerfile Configuration

```dockerfile
# Build stage
FROM eclipse-temurin:17-jdk-alpine as build
WORKDIR /workspace/app

# Copy Maven files
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
COPY src src

# Build application
RUN ./mvnw install -DskipTests
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar)

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
VOLUME /tmp
ARG DEPENDENCY=/workspace/app/target/dependency

# Copy application layers
COPY --from=build ${DEPENDENCY}/BOOT-INF/lib /app/lib
COPY --from=build ${DEPENDENCY}/META-INF /app/META-INF
COPY --from=build ${DEPENDENCY}/BOOT-INF/classes /app

# Set entrypoint
ENTRYPOINT ["java", "-cp", "app:app/lib/*", "com.example.Application"]
```

### 2. Docker Compose Configuration

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myapp
      - SPRING_DATASOURCE_USERNAME=${DB_USERNAME}
      - SPRING_DATASOURCE_PASSWORD=${DB_PASSWORD}
      - SPRING_KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    depends_on:
      - db
      - kafka
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:14-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=${DB_USERNAME}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  kafka:
    image: confluentinc/cp-kafka:7.0.0
    ports:
      - "9092:9092"
    environment:
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      - KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      - KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT
      - KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.0
    environment:
      - ZOOKEEPER_CLIENT_PORT=2181
      - ZOOKEEPER_TICK_TIME=2000

volumes:
  postgres_data:
```

### 3. Spring Boot Docker Configuration

```yaml
spring:
  config:
    activate:
      on-profile: docker
  datasource:
    url: jdbc:postgresql://db:5432/myapp
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
  kafka:
    bootstrap-servers: kafka:29092
    consumer:
      group-id: myapp
      auto-offset-reset: earliest

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
      probes:
        enabled: true
```

## Real-World Examples

### 1. Multi-Service Docker Setup

```yaml
version: '3.8'

services:
  api-gateway:
    build:
      context: ./api-gateway
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://service-registry:8761/eureka/
    depends_on:
      - service-registry

  service-registry:
    build:
      context: ./service-registry
      dockerfile: Dockerfile
    ports:
      - "8761:8761"
    environment:
      - SPRING_PROFILES_ACTIVE=docker

  order-service:
    build:
      context: ./order-service
      dockerfile: Dockerfile
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SPRING_DATASOURCE_URL=jdbc:postgresql://order-db:5432/orders
      - EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://service-registry:8761/eureka/
    depends_on:
      - order-db
      - service-registry

  payment-service:
    build:
      context: ./payment-service
      dockerfile: Dockerfile
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SPRING_DATASOURCE_URL=jdbc:postgresql://payment-db:5432/payments
      - EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://service-registry:8761/eureka/
    depends_on:
      - payment-db
      - service-registry

  order-db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=orders
      - POSTGRES_USER=${ORDER_DB_USER}
      - POSTGRES_PASSWORD=${ORDER_DB_PASSWORD}
    volumes:
      - order_data:/var/lib/postgresql/data

  payment-db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=payments
      - POSTGRES_USER=${PAYMENT_DB_USER}
      - POSTGRES_PASSWORD=${PAYMENT_DB_PASSWORD}
    volumes:
      - payment_data:/var/lib/postgresql/data

volumes:
  order_data:
  payment_data:
```

### 2. Production-Ready Dockerfile

```dockerfile
# Build stage
FROM eclipse-temurin:17-jdk-alpine as build
WORKDIR /workspace/app

# Copy Maven files
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Download dependencies
RUN ./mvnw dependency:go-offline

# Copy source code
COPY src src

# Build application
RUN ./mvnw package -DskipTests
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar)

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install necessary tools
RUN apk add --no-cache curl

# Add non-root user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy application from build stage
ARG DEPENDENCY=/workspace/app/target/dependency
COPY --from=build ${DEPENDENCY}/BOOT-INF/lib /app/lib
COPY --from=build ${DEPENDENCY}/META-INF /app/META-INF
COPY --from=build ${DEPENDENCY}/BOOT-INF/classes /app

# Configure JVM
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Set entrypoint
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -cp app:app/lib/* com.example.Application"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8080/actuator/health || exit 1
```

### 3. Development Environment Setup

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
      - "5005:5005"  # Debug port
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - JAVA_TOOL_OPTIONS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
    volumes:
      - ./src:/workspace/app/src
      - maven_cache:/root/.m2
    depends_on:
      - db
      - kafka

  db:
    image: postgres:14-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=myapp_dev
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  kafka:
    image: confluentinc/cp-kafka:7.0.0
    ports:
      - "9092:9092"
    environment:
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      - KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      - KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT
      - KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.0
    environment:
      - ZOOKEEPER_CLIENT_PORT=2181

volumes:
  postgres_dev_data:
  maven_cache:
```

## Common Pitfalls

1. ❌ Large container images
   ✅ Use multi-stage builds

2. ❌ Running as root
   ✅ Use non-root user

3. ❌ Hardcoded credentials
   ✅ Use environment variables

4. ❌ No health checks
   ✅ Implement proper health checks

## Best Practices

1. Use multi-stage builds
2. Optimize layer caching
3. Implement health checks
4. Use non-root users
5. Externalize configuration
6. Handle signals properly
7. Use volume mounts
8. Monitor containers

## Knowledge Check

- [ ] Create Dockerfile
- [ ] Configure Docker Compose
- [ ] Implement health checks
- [ ] Set up development environment
- [ ] Optimize container builds
- [ ] Secure containers

## Additional Resources

- [Spring Boot Docker](https://spring.io/guides/topicals/spring-boot-docker/)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Container Security](https://snyk.io/learn/container-security/)

---

⬅️ Previous: [Microservices Development](./31-microservices-dev.md)

➡️ Next: [CI/CD](./33-cicd.md)