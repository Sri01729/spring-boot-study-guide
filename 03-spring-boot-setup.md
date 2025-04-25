# Spring Boot Setup & Project Structure 🛠️

## Overview

Learn how to set up a Spring Boot project, understand the project structure, and master dependency management. This module covers both IDE-based and command-line setup approaches.

## Project Initialization

### Using Spring Initializr

1. Visit [start.spring.io](https://start.spring.io)
2. Configure project:
   ```yaml
   Project: Maven
   Language: Java
   Spring Boot: 3.2.x
   Packaging: Jar
   Java Version: 17
   ```
3. Add common dependencies:
   - Spring Web
   - Spring Data JPA
   - Spring Security
   - Lombok
   - Spring Boot DevTools

### Using Command Line

```bash
# Using Spring Boot CLI
spring init --build=maven --java-version=17 \
  --dependencies=web,data-jpa,security \
  --packaging=jar my-project

# Using curl
curl https://start.spring.io/starter.zip -d type=maven-project \
  -d language=java -d bootVersion=3.2.0 \
  -d baseDir=my-project -d packaging=jar \
  -d javaVersion=17 -o my-project.zip
```

## Project Structure

```plaintext
my-project/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/project/
│   │   │       ├── MyProjectApplication.java
│   │   │       ├── config/
│   │   │       ├── controller/
│   │   │       ├── model/
│   │   │       ├── repository/
│   │   │       └── service/
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── static/
│   │       └── templates/
│   └── test/
│       └── java/
│           └── com/example/project/
├── .gitignore
├── pom.xml
└── README.md
```

## Essential Configuration

### pom.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>my-project</artifactId>
    <version>0.0.1-SNAPSHOT</version>

    <properties>
        <java.version>17</java.version>
        <lombok.version>1.18.30</lombok.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>

        <!-- Development Tools -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-devtools</artifactId>
            <scope>runtime</scope>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Test Dependencies -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### application.yml
```yaml
spring:
  application:
    name: my-project

  # Database Configuration
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: postgres
    password: postgres

  # JPA Properties
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true

  # Security Configuration
  security:
    user:
      name: admin
      password: admin

# Server Configuration
server:
  port: 8080
  error:
    include-message: always
    include-binding-errors: always

# Logging Configuration
logging:
  level:
    root: INFO
    com.example: DEBUG
    org.springframework.web: INFO
    org.hibernate: ERROR
```

## Mini-Project: Project Template Generator

Create a script that generates a Spring Boot project with best practices:

```java
@SpringBootApplication
public class ProjectTemplateGenerator {
    private static final String BASE_PACKAGE = "com.example.project";

    public static void main(String[] args) {
        generateProjectStructure();
    }

    private static void generateProjectStructure() {
        createDirectories();
        createBaseFiles();
        createConfigFiles();
    }

    private static void createDirectories() {
        List<String> directories = Arrays.asList(
            "config",
            "controller",
            "model",
            "repository",
            "service",
            "exception",
            "security",
            "util"
        );

        directories.forEach(dir -> {
            Path path = Paths.get("src/main/java", BASE_PACKAGE.split("\\."), dir);
            try {
                Files.createDirectories(path);
            } catch (IOException e) {
                throw new RuntimeException("Failed to create directory: " + dir, e);
            }
        });
    }
}
```

## Common Pitfalls

1. ❌ Mixing different Spring Boot versions
   ✅ Use spring-boot-starter-parent for version management

2. ❌ Manual dependency version management
   ✅ Leverage Spring Boot's dependency management

3. ❌ Incorrect package structure
   ✅ Follow standard package naming conventions

4. ❌ Hardcoded configuration
   ✅ Use externalized configuration with profiles

## Best Practices

1. Use Spring Initializr for project setup
2. Follow standard project structure
3. Implement proper package organization
4. Use YAML over properties files
5. Configure logging appropriately
6. Include actuator for monitoring
7. Set up proper .gitignore

## Knowledge Check

- [ ] Explain Spring Boot starters
- [ ] Describe project structure
- [ ] List essential dependencies
- [ ] Configure application properties
- [ ] Set up development environment
- [ ] Understand dependency management

## Additional Resources

- [Spring Boot Reference](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Spring Initializr](https://start.spring.io)
- [Maven Documentation](https://maven.apache.org/guides/)
- [Gradle Documentation](https://docs.gradle.org)

---

⬅️ Previous: [Java Fundamentals](./02-java-fundamentals.md)

➡️ Next: [Annotations Deep Dive](./04-annotations.md)