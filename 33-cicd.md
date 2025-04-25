# CI/CD with Spring Boot 🔄

## Overview

Master Continuous Integration and Continuous Deployment (CI/CD) for Spring Boot applications. Learn about automated testing, building, and deployment strategies.

## Core Concepts

### 1. GitHub Actions Workflow

```yaml
name: Spring Boot CI/CD

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: maven

    - name: Build with Maven
      run: ./mvnw clean verify

    - name: Run Tests
      run: ./mvnw test

    - name: Build Docker image
      run: docker build -t myapp:${{ github.sha }} .

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: myapp:${{ github.sha }}
        format: 'table'
        exit-code: '1'
        ignore-unfixed: true
        severity: 'CRITICAL,HIGH'

    - name: Login to Docker Hub
      if: github.ref == 'refs/heads/main'
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_HUB_USERNAME }}
        password: ${{ secrets.DOCKER_HUB_TOKEN }}

    - name: Push to Docker Hub
      if: github.ref == 'refs/heads/main'
      run: |
        docker tag myapp:${{ github.sha }} ${{ secrets.DOCKER_HUB_USERNAME }}/myapp:latest
        docker push ${{ secrets.DOCKER_HUB_USERNAME }}/myapp:latest
```

### 2. Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'myapp'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        DOCKER_REGISTRY = 'registry.example.com'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh './mvnw clean package -DskipTests'
            }
        }

        stage('Test') {
            steps {
                sh './mvnw test'
            }
            post {
                always {
                    junit '**/target/surefire-reports/*.xml'
                    jacoco(
                        execPattern: '**/target/jacoco.exec',
                        classPattern: '**/target/classes',
                        sourcePattern: '**/src/main/java'
                    )
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh './mvnw sonar:sonar'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("${DOCKER_IMAGE}:${DOCKER_TAG}")
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'registry-credentials') {
                        docker.image("${DOCKER_IMAGE}:${DOCKER_TAG}").push()
                        docker.image("${DOCKER_IMAGE}:${DOCKER_TAG}").push('latest')
                    }
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh """
                    kubectl set image deployment/myapp \
                    myapp=${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} \
                    --namespace=staging
                """
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                timeout(time: 1, unit: 'HOURS') {
                    input message: 'Deploy to production?'
                }
                sh """
                    kubectl set image deployment/myapp \
                    myapp=${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} \
                    --namespace=production
                """
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            slackSend(
                color: 'good',
                message: "Build successful: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                color: 'danger',
                message: "Build failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
        }
    }
}
```

### 3. Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
    type: RollingUpdate
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: registry.example.com/myapp:latest
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: SPRING_DATASOURCE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: SPRING_DATASOURCE_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: username
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

---
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: myapp

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp
            port:
              number: 80
```

## Real-World Examples

### 1. Multi-Environment Pipeline

```groovy
def environments = [
    'dev': [
        namespace: 'development',
        replicas: 1,
        resources: [
            requests: [cpu: '200m', memory: '256Mi'],
            limits: [cpu: '500m', memory: '512Mi']
        ]
    ],
    'staging': [
        namespace: 'staging',
        replicas: 2,
        resources: [
            requests: [cpu: '500m', memory: '512Mi'],
            limits: [cpu: '1000m', memory: '1Gi']
        ]
    ],
    'prod': [
        namespace: 'production',
        replicas: 3,
        resources: [
            requests: [cpu: '1000m', memory: '1Gi'],
            limits: [cpu: '2000m', memory: '2Gi']
        ]
    ]
]

pipeline {
    agent any

    environment {
        APP_NAME = 'myapp'
        VERSION = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Build and Test') {
            steps {
                sh './mvnw clean verify'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    environments.each { env, config ->
                        docker.build(
                            "${APP_NAME}-${env}:${VERSION}",
                            "--build-arg SPRING_PROFILES_ACTIVE=${env} ."
                        )
                    }
                }
            }
        }

        stage('Deploy to Development') {
            when { branch 'develop' }
            steps {
                script {
                    deployToEnvironment('dev')
                }
            }
        }

        stage('Deploy to Staging') {
            when { branch 'release/*' }
            steps {
                script {
                    deployToEnvironment('staging')
                }
            }
        }

        stage('Deploy to Production') {
            when { branch 'main' }
            steps {
                timeout(time: 1, unit: 'HOURS') {
                    input message: 'Deploy to production?'
                }
                script {
                    deployToEnvironment('prod')
                }
            }
        }
    }
}

def deployToEnvironment(String env) {
    def config = environments[env]

    sh """
        helm upgrade --install ${APP_NAME}-${env} ./helm \
            --namespace=${config.namespace} \
            --set image.tag=${VERSION} \
            --set replicas=${config.replicas} \
            --set resources.requests.cpu=${config.resources.requests.cpu} \
            --set resources.requests.memory=${config.resources.requests.memory} \
            --set resources.limits.cpu=${config.resources.limits.cpu} \
            --set resources.limits.memory=${config.resources.limits.memory}
    """
}
```

### 2. Quality Gates Pipeline

```groovy
pipeline {
    agent any

    environment {
        SONAR_PROJECT_KEY = 'myapp'
    }

    stages {
        stage('Build and Test') {
            steps {
                sh './mvnw clean verify'
            }
            post {
                always {
                    junit '**/target/surefire-reports/*.xml'
                    jacoco(
                        execPattern: '**/target/jacoco.exec',
                        classPattern: '**/target/classes',
                        sourcePattern: '**/src/main/java',
                        exclusionPattern: '**/generated/**'
                    )
                }
            }
        }

        stage('Code Quality') {
            parallel {
                stage('SonarQube Analysis') {
                    steps {
                        withSonarQubeEnv('SonarQube') {
                            sh """
                                ./mvnw sonar:sonar \
                                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                                -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
                            """
                        }
                    }
                }

                stage('Dependency Check') {
                    steps {
                        sh './mvnw org.owasp:dependency-check-maven:check'
                    }
                    post {
                        always {
                            dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
                        }
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
    }
}
```

### 3. Blue-Green Deployment

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/myapp.git
    targetRevision: HEAD
    path: helm
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true

---
apiVersion: networking.k8s.io/v1
kind: Service
metadata:
  name: myapp
  namespace: production
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  selector:
    app: myapp
    color: blue
  ports:
  - port: 80
    targetPort: 8080

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  namespace: production
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      color: blue
  template:
    metadata:
      labels:
        app: myapp
        color: blue
    spec:
      containers:
      - name: myapp
        image: registry.example.com/myapp:latest
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  namespace: production
  annotations:
    argocd.argoproj.io/sync-wave: "3"
spec:
  replicas: 0
  selector:
    matchLabels:
      app: myapp
      color: green
  template:
    metadata:
      labels:
        app: myapp
        color: green
    spec:
      containers:
      - name: myapp
        image: registry.example.com/myapp:latest
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Common Pitfalls

1. ❌ No automated tests
   ✅ Implement comprehensive testing

2. ❌ Manual deployments
   ✅ Automate deployment process

3. ❌ No rollback strategy
   ✅ Implement rollback mechanisms

4. ❌ Insecure secrets
   ✅ Use secret management

## Best Practices

1. Automate everything
2. Use version control
3. Implement quality gates
4. Monitor deployments
5. Secure pipelines
6. Use infrastructure as code
7. Implement rollback strategies
8. Practice continuous testing

## Knowledge Check

- [ ] Set up CI pipeline
- [ ] Configure CD pipeline
- [ ] Implement quality gates
- [ ] Set up monitoring
- [ ] Configure notifications
- [ ] Implement security scans

## Additional Resources

- [GitHub Actions](https://docs.github.com/en/actions)
- [Jenkins Pipeline](https://www.jenkins.io/doc/book/pipeline/)
- [ArgoCD](https://argo-cd.readthedocs.io/)
- [SonarQube](https://docs.sonarqube.org/)

---

⬅️ Previous: [Docker](./32-docker.md)

➡️ Next: [Deployment](./34-deployment.md)