# Deployment in Spring Boot 🚀

## Overview

Master deployment strategies for Spring Boot applications. Learn about containerization, cloud deployment, CI/CD pipelines, and deployment best practices.

## Core Concepts

### Docker Configuration
```dockerfile
# Dockerfile
FROM eclipse-temurin:17-jdk-alpine as builder
WORKDIR /app
COPY . .
RUN ./gradlew clean bootJar

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Kubernetes Configuration
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spring-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: spring-app
  template:
    metadata:
      labels:
        app: spring-app
    spec:
      containers:
      - name: spring-app
        image: spring-app:latest
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: db-host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: db-password
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 20

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: spring-app
  namespace: production
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: spring-app

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  db-host: "prod-db.example.com"
  redis-host: "prod-redis.example.com"
  kafka-brokers: "prod-kafka:9092"
```

## Real-World Examples

### 1. CI/CD Pipeline with GitHub Actions

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: gradle

    - name: Build and Test
      run: ./gradlew clean build

    - name: Run Integration Tests
      run: ./gradlew integrationTest

    - name: Build Docker Image
      run: docker build -t spring-app:${{ github.sha }} .

    - name: Run Container Tests
      run: |
        docker run -d --name test-app spring-app:${{ github.sha }}
        sleep 30
        docker exec test-app curl -f http://localhost:8080/actuator/health

    - name: Push to Registry
      if: github.ref == 'refs/heads/main'
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker tag spring-app:${{ github.sha }} ${{ secrets.DOCKER_REGISTRY }}/spring-app:${{ github.sha }}
        docker push ${{ secrets.DOCKER_REGISTRY }}/spring-app:${{ github.sha }}

    - name: Deploy to Production
      if: github.ref == 'refs/heads/main'
      run: |
        echo "${{ secrets.KUBECONFIG }}" > kubeconfig
        export KUBECONFIG=kubeconfig

        # Update deployment image
        kubectl set image deployment/spring-app \
          spring-app=${{ secrets.DOCKER_REGISTRY }}/spring-app:${{ github.sha }} \
          --namespace=production

        # Wait for rollout
        kubectl rollout status deployment/spring-app \
          --namespace=production \
          --timeout=300s
```

### 2. Cloud Configuration (AWS)

```yaml
# aws/cloudformation.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Spring Boot Application Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: prod
    AllowedValues:
      - dev
      - staging
      - prod

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-vpc

  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub ${AWS::StackName}-cluster
      CapacityProviders:
        - FARGATE
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1

  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub ${AWS::StackName}-task
      RequiresCompatibilities:
        - FARGATE
      NetworkMode: awsvpc
      Cpu: 256
      Memory: 512
      ExecutionRoleArn: !GetAtt ECSExecutionRole.Arn
      ContainerDefinitions:
        - Name: spring-app
          Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/spring-app:latest
          PortMappings:
            - ContainerPort: 8080
          Environment:
            - Name: SPRING_PROFILES_ACTIVE
              Value: !Ref Environment
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: spring-app

  Service:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: !Sub ${AWS::StackName}-service
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: ENABLED
          Subnets:
            - !Ref PublicSubnet1
            - !Ref PublicSubnet2
          SecurityGroups:
            - !Ref ContainerSecurityGroup
      LoadBalancers:
        - ContainerName: spring-app
          ContainerPort: 8080
          TargetGroupArn: !Ref TargetGroup
```

### 3. Monitoring and Scaling

```yaml
# kubernetes/monitoring.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: spring-app
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: spring-app
  endpoints:
  - port: web
    path: /actuator/prometheus
    interval: 15s

---
# kubernetes/autoscaling.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: spring-app
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: spring-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60
```

## Common Pitfalls

1. ❌ Hardcoding configurations
   ✅ Use environment variables and config maps

2. ❌ Missing health checks
   ✅ Implement comprehensive health probes

3. ❌ Poor resource management
   ✅ Set appropriate resource limits

4. ❌ Inadequate monitoring
   ✅ Implement proper observability

## Best Practices

1. Use containerization
2. Implement CI/CD
3. Configure auto-scaling
4. Set up monitoring
5. Use blue-green deployment
6. Implement secrets management
7. Configure logging
8. Regular backups

## Knowledge Check

- [ ] Create Dockerfile
- [ ] Configure Kubernetes
- [ ] Set up CI/CD pipeline
- [ ] Implement auto-scaling
- [ ] Configure cloud resources
- [ ] Set up monitoring

## Additional Resources

- [Spring Boot Docker Guide](https://spring.io/guides/topicals/spring-boot-docker/)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)

---

⬅️ Previous: [Error Handling](./11-error-handling.md)

➡️ Next: [Performance](./13-performance.md)