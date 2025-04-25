# Java Fundamentals for Spring Boot 📚

## Overview

Modern Spring Boot development requires strong Java fundamentals, especially features introduced in Java 8+. This module covers essential Java concepts used throughout Spring Boot applications.

## Core Concepts

### 1. Object-Oriented Programming
- Classes and Objects
- Inheritance and Polymorphism
- Interfaces and Abstract Classes
- Encapsulation

### 2. Functional Programming in Java
- Lambda Expressions
- Method References
- Functional Interfaces
- Stream API

### 3. Collections Framework
- Lists, Sets, Maps
- Collection Operations
- Sorting and Filtering
- Concurrent Collections

### 4. Exception Handling
- Checked vs Unchecked Exceptions
- Try-with-resources
- Custom Exceptions
- Best Practices

## Real-World Examples

### 1. Functional Programming

```java
// Traditional approach
List<String> names = Arrays.asList("John", "Jane", "Bob", "Alice");
List<String> filteredNames = new ArrayList<>();
for (String name : names) {
    if (name.startsWith("J")) {
        filteredNames.add(name.toUpperCase());
    }
}

// Modern approach with streams
List<String> modernFiltered = names.stream()
    .filter(name -> name.startsWith("J"))
    .map(String::toUpperCase)
    .collect(Collectors.toList());
```

### 2. Optional for Null Safety

```java
public class UserService {
    private UserRepository repository;

    // Instead of returning null
    public Optional<User> findByEmail(String email) {
        return Optional.ofNullable(repository.findByEmail(email));
    }

    // Using Optional in business logic
    public String getUserName(String email) {
        return findByEmail(email)
            .map(User::getName)
            .orElse("Guest");
    }
}
```

### 3. Modern Exception Handling

```java
public class ResourceHandler {
    // Try-with-resources
    public String readFile(Path path) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(path)) {
            return reader.lines()
                .collect(Collectors.joining("\n"));
        }
    }

    // Custom exception
    public class ResourceNotFoundException extends RuntimeException {
        public ResourceNotFoundException(String id) {
            super("Resource not found: " + id);
        }
    }
}
```

## Mini-Project: Event Processing System

Create a system that processes events using modern Java features:

```java
@Data
@Builder
public class Event {
    private String id;
    private LocalDateTime timestamp;
    private String type;
    private Map<String, Object> payload;
}

public class EventProcessor {
    private final List<Event> events = new ArrayList<>();

    public void addEvent(Event event) {
        events.add(event);
    }

    public List<Event> getEventsByType(String type) {
        return events.stream()
            .filter(event -> event.getType().equals(type))
            .sorted(Comparator.comparing(Event::getTimestamp).reversed())
            .collect(Collectors.toList());
    }

    public Map<String, Long> getEventCounts() {
        return events.stream()
            .collect(Collectors.groupingBy(
                Event::getType,
                Collectors.counting()
            ));
    }

    public Optional<Event> getLatestEvent() {
        return events.stream()
            .max(Comparator.comparing(Event::getTimestamp));
    }
}
```

## Common Pitfalls

1. ❌ Using raw types with collections
   ✅ Always use generics

2. ❌ Null checks everywhere
   ✅ Use Optional for nullable values

3. ❌ Traditional loops for everything
   ✅ Use Stream API for data processing

4. ❌ Catching Exception
   ✅ Catch specific exceptions

## Best Practices

1. Use immutable objects when possible
2. Leverage functional programming
3. Handle exceptions appropriately
4. Use Java Time API instead of old Date
5. Implement proper equals() and hashCode()
6. Use builder pattern for complex objects

## Knowledge Check

- [ ] Explain lambda expressions
- [ ] Describe Stream API benefits
- [ ] List key functional interfaces
- [ ] Explain Optional usage
- [ ] Describe try-with-resources
- [ ] Compare ArrayList vs LinkedList

## Coding Exercises

1. Create a list of objects and:
   - Filter based on a condition
   - Transform using map
   - Collect to a Map
   - Find max/min values

2. Implement a custom exception and handler

3. Create a service using Optional

## Additional Resources

- [Java Language Specification](https://docs.oracle.com/javase/specs/)
- [Modern Java in Action](https://www.manning.com/books/modern-java-in-action)
- [Java 8 in Action](https://www.manning.com/books/java-8-in-action)
- [Effective Java](https://www.oreilly.com/library/view/effective-java-3rd/9780134686097/)

---

⬅️ Previous: [Introduction to Spring Boot](./01-introduction.md)

➡️ Next: [Spring Boot Setup](./03-spring-boot-setup.md)