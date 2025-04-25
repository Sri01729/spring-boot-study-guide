# Security in Spring Boot 🔒

## Overview

Master Spring Security implementation in Spring Boot applications. Learn about authentication, authorization, JWT tokens, OAuth2, and security best practices.

## Core Concepts

### 1. Security Configuration

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;
    private final LogoutHandler logoutHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api/v1/public/**").permitAll()
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .logout(logout -> logout
                .logoutUrl("/api/v1/auth/logout")
                .addLogoutHandler(logoutHandler)
                .logoutSuccessHandler((request, response, authentication) ->
                    SecurityContextHolder.clearContext())
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("https://example.com"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
```

### 2. JWT Authentication

```java
@Service
@Slf4j
public class JwtService {
    @Value("${application.security.jwt.secret-key}")
    private String secretKey;

    @Value("${application.security.jwt.expiration}")
    private long jwtExpiration;

    @Value("${application.security.jwt.refresh-token.expiration}")
    private long refreshExpiration;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(
        Map<String, Object> extraClaims,
        UserDetails userDetails
    ) {
        return buildToken(extraClaims, userDetails, jwtExpiration);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return buildToken(new HashMap<>(), userDetails, refreshExpiration);
    }

    private String buildToken(
        Map<String, Object> extraClaims,
        UserDetails userDetails,
        long expiration
    ) {
        return Jwts
            .builder()
            .setClaims(extraClaims)
            .setSubject(userDetails.getUsername())
            .setIssuedAt(new Date(System.currentTimeMillis()))
            .setExpiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSignInKey(), SignatureAlgorithm.HS256)
            .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername())) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts
            .parserBuilder()
            .setSigningKey(getSignInKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
```

### 3. OAuth2 Configuration

```java
@Configuration
public class OAuth2Config {
    @Bean
    public SecurityFilterChain oauth2SecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(authorization -> authorization
                    .baseUri("/oauth2/authorize")
                    .authorizationRequestRepository(cookieAuthorizationRequestRepository())
                )
                .redirectionEndpoint(redirection -> redirection
                    .baseUri("/oauth2/callback/*")
                )
                .userInfoEndpoint(userInfo -> userInfo
                    .userService(customOAuth2UserService)
                )
                .successHandler(oAuth2AuthenticationSuccessHandler)
                .failureHandler(oAuth2AuthenticationFailureHandler)
            )
            .oauth2ResourceServer(oauth2ResourceServer -> oauth2ResourceServer
                .jwt(jwt -> jwt.decoder(jwtDecoder()))
            );

        return http.build();
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withPublicKey(rsaPublicKey).build();
    }

    @Bean
    public OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> accessTokenResponseClient() {
        DefaultAuthorizationCodeTokenResponseClient accessTokenResponseClient =
            new DefaultAuthorizationCodeTokenResponseClient();

        OAuth2AccessTokenResponseHttpMessageConverter tokenResponseHttpMessageConverter =
            new OAuth2AccessTokenResponseHttpMessageConverter();

        tokenResponseHttpMessageConverter.setTokenResponseConverter(new CustomTokenResponseConverter());

        RestTemplate restTemplate = new RestTemplate(Arrays.asList(
            new FormHttpMessageConverter(),
            tokenResponseHttpMessageConverter
        ));

        accessTokenResponseClient.setRestOperations(restTemplate);

        return accessTokenResponseClient;
    }
}
```

## Real-World Examples

### 1. Authentication Service

```java
@Service
@Slf4j
public class AuthenticationService {
    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthenticationResponse register(RegisterRequest request) {
        var user = User.builder()
            .firstName(request.getFirstName())
            .lastName(request.getLastName())
            .email(request.getEmail())
            .password(passwordEncoder.encode(request.getPassword()))
            .role(Role.USER)
            .build();

        var savedUser = userRepository.save(user);
        var jwtToken = jwtService.generateToken(user);
        var refreshToken = jwtService.generateRefreshToken(user);
        saveUserToken(savedUser, jwtToken);

        return AuthenticationResponse.builder()
            .accessToken(jwtToken)
            .refreshToken(refreshToken)
            .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.getEmail(),
                request.getPassword()
            )
        );

        var user = userRepository.findByEmail(request.getEmail())
            .orElseThrow();
        var jwtToken = jwtService.generateToken(user);
        var refreshToken = jwtService.generateRefreshToken(user);
        revokeAllUserTokens(user);
        saveUserToken(user, jwtToken);

        return AuthenticationResponse.builder()
            .accessToken(jwtToken)
            .refreshToken(refreshToken)
            .build();
    }

    private void saveUserToken(User user, String jwtToken) {
        var token = Token.builder()
            .user(user)
            .token(jwtToken)
            .tokenType(TokenType.BEARER)
            .expired(false)
            .revoked(false)
            .build();
        tokenRepository.save(token);
    }

    private void revokeAllUserTokens(User user) {
        var validUserTokens = tokenRepository.findAllValidTokenByUser(user.getId());
        if (validUserTokens.isEmpty())
            return;

        validUserTokens.forEach(token -> {
            token.setExpired(true);
            token.setRevoked(true);
        });
        tokenRepository.saveAll(validUserTokens);
    }
}
```

### 2. Security Audit Service

```java
@Service
@Slf4j
public class SecurityAuditService {
    private final SecurityEventRepository securityEventRepository;
    private final NotificationService notificationService;

    @Async
    public void logSecurityEvent(SecurityEventType eventType, String username, String details) {
        try {
            SecurityEvent event = SecurityEvent.builder()
                .type(eventType)
                .username(username)
                .details(details)
                .timestamp(LocalDateTime.now())
                .ipAddress(getCurrentIpAddress())
                .build();

            securityEventRepository.save(event);

            if (eventType.getSeverity().isHigherThan(Severity.MEDIUM)) {
                notificationService.notifySecurityTeam(event);
            }
        } catch (Exception e) {
            log.error("Failed to log security event", e);
        }
    }

    public void checkForSuspiciousActivity(String username) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(30);
        long failedAttempts = securityEventRepository.countFailedLoginAttempts(username, threshold);

        if (failedAttempts >= 5) {
            notificationService.notifySecurityTeam(
                String.format("Suspicious activity detected for user %s: %d failed login attempts",
                    username, failedAttempts)
            );
        }
    }

    private String getCurrentIpAddress() {
        return Optional.ofNullable(RequestContextHolder.getRequestAttributes())
            .filter(ServletRequestAttributes.class::isInstance)
            .map(ServletRequestAttributes.class::cast)
            .map(ServletRequestAttributes::getRequest)
            .map(request -> request.getHeader("X-Forwarded-For"))
            .orElse("unknown");
    }
}
```

### 3. Role-Based Access Control

```java
@Service
@Slf4j
public class RoleBasedAccessService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Transactional
    public void assignRole(Long userId, String roleName) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
        Role role = roleRepository.findByName(roleName)
            .orElseThrow(() -> new RoleNotFoundException(roleName));

        user.getRoles().add(role);
        userRepository.save(user);
        log.info("Assigned role {} to user {}", roleName, userId);
    }

    @Transactional
    public void removeRole(Long userId, String roleName) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
        Role role = roleRepository.findByName(roleName)
            .orElseThrow(() -> new RoleNotFoundException(roleName));

        user.getRoles().remove(role);
        userRepository.save(user);
        log.info("Removed role {} from user {}", roleName, userId);
    }

    public boolean hasPermission(Long userId, String permission) {
        return userRepository.findById(userId)
            .map(user -> user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(p -> p.getName().equals(permission)))
            .orElse(false);
    }
}
```

## Common Pitfalls

1. ❌ Storing sensitive data in tokens
   ✅ Include only necessary claims in JWT

2. ❌ Missing token validation
   ✅ Validate tokens properly

3. ❌ Weak password policies
   ✅ Implement strong password rules

4. ❌ Insufficient logging
   ✅ Implement security audit logging

## Best Practices

1. Use HTTPS everywhere
2. Implement proper authentication
3. Use secure password storage
4. Enable CSRF protection
5. Configure CORS properly
6. Implement rate limiting
7. Use security headers
8. Regular security audits

## Knowledge Check

- [ ] Configure Spring Security
- [ ] Implement JWT authentication
- [ ] Set up OAuth2
- [ ] Configure CORS
- [ ] Implement RBAC
- [ ] Set up security auditing

## Additional Resources

- [Spring Security Reference](https://docs.spring.io/spring-security/reference/index.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT.io](https://jwt.io/)
- [OAuth 2.0](https://oauth.net/2/)

---

⬅️ Previous: [Scheduling](./22-scheduling.md)

➡️ Next: [Monitoring](./24-monitoring.md)