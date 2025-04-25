# Spring Boot File Operations 📁

## Overview

Master file operations in Spring Boot applications. Learn about file uploads, downloads, storage strategies, and best practices for handling files efficiently.

## Core Concepts

### 1. File Storage Configuration

```java
@Configuration
@EnableConfigurationProperties(FileStorageProperties.class)
public class FileStorageConfig {
    @Bean
    public FileStorageService fileStorageService(FileStorageProperties properties) {
        return new FileStorageService(properties);
    }
}

@ConfigurationProperties(prefix = "file")
@Data
public class FileStorageProperties {
    private String uploadDir;
    private long maxFileSize = 10485760; // 10MB
    private List<String> allowedExtensions = Arrays.asList(
        "jpg", "jpeg", "png", "pdf", "doc", "docx");
    private boolean preserveFilename = false;
    private String tempDir;
}

@Service
@Slf4j
public class FileStorageService {
    private final Path fileStorageLocation;
    private final FileStorageProperties properties;

    public FileStorageService(FileStorageProperties properties) {
        this.properties = properties;
        this.fileStorageLocation = Paths.get(properties.getUploadDir())
            .toAbsolutePath().normalize();

        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (IOException e) {
            throw new FileStorageException(
                "Could not create upload directory", e);
        }
    }

    public String storeFile(MultipartFile file) {
        validateFile(file);

        String fileName = generateFileName(file);
        try {
            Path targetLocation = this.fileStorageLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetLocation,
                StandardCopyOption.REPLACE_EXISTING);
            return fileName;
        } catch (IOException e) {
            throw new FileStorageException(
                "Could not store file " + fileName, e);
        }
    }

    private void validateFile(MultipartFile file) {
        String extension = getFileExtension(file.getOriginalFilename());
        if (!properties.getAllowedExtensions().contains(extension)) {
            throw new FileValidationException(
                "File type not allowed: " + extension);
        }

        if (file.getSize() > properties.getMaxFileSize()) {
            throw new FileValidationException(
                "File size exceeds maximum limit");
        }
    }

    private String generateFileName(MultipartFile file) {
        String originalFileName = StringUtils.cleanPath(
            file.getOriginalFilename());

        if (properties.isPreserveFilename()) {
            return originalFileName;
        }

        String extension = getFileExtension(originalFileName);
        return UUID.randomUUID().toString() + "." + extension;
    }
}
```

### 2. File Upload Controller

```java
@RestController
@RequestMapping("/api/v1/files")
@Slf4j
public class FileController {
    private final FileStorageService fileStorageService;

    @PostMapping("/upload")
    public ResponseEntity<FileUploadResponse> uploadFile(
            @RequestParam("file") MultipartFile file) {
        String fileName = fileStorageService.storeFile(file);
        String fileDownloadUri = ServletUriComponentsBuilder.fromCurrentContextPath()
            .path("/api/v1/files/download/")
            .path(fileName)
            .toUriString();

        return ResponseEntity.ok(FileUploadResponse.builder()
            .fileName(fileName)
            .fileDownloadUri(fileDownloadUri)
            .size(file.getSize())
            .contentType(file.getContentType())
            .build());
    }

    @PostMapping("/upload/multiple")
    public ResponseEntity<List<FileUploadResponse>> uploadMultipleFiles(
            @RequestParam("files") MultipartFile[] files) {
        return ResponseEntity.ok(Arrays.stream(files)
            .map(this::uploadFile)
            .map(ResponseEntity::getBody)
            .collect(Collectors.toList()));
    }

    @GetMapping("/download/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String fileName,
            HttpServletRequest request) {
        Resource resource = fileStorageService.loadFileAsResource(fileName);

        String contentType = determineContentType(request, resource);

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + resource.getFilename() + "\"")
            .body(resource);
    }

    private String determineContentType(HttpServletRequest request,
            Resource resource) {
        try {
            return request.getServletContext()
                .getMimeType(resource.getFile().getAbsolutePath());
        } catch (IOException e) {
            return MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
    }
}
```

### 3. File Processing Service

```java
@Service
@Slf4j
public class FileProcessingService {
    private final FileStorageService fileStorageService;
    private final ImageService imageService;
    private final DocumentService documentService;

    @Async
    public CompletableFuture<ProcessedFile> processFile(
            MultipartFile file, ProcessingOptions options) {
        return CompletableFuture.supplyAsync(() -> {
            String fileName = fileStorageService.storeFile(file);
            String extension = getFileExtension(fileName);

            ProcessedFile processedFile = new ProcessedFile();
            processedFile.setOriginalFileName(fileName);

            if (isImage(extension)) {
                processImageFile(fileName, options, processedFile);
            } else if (isDocument(extension)) {
                processDocumentFile(fileName, options, processedFile);
            }

            return processedFile;
        });
    }

    private void processImageFile(String fileName,
            ProcessingOptions options,
            ProcessedFile processedFile) {
        if (options.isResizeEnabled()) {
            String resizedFileName = imageService.resize(
                fileName,
                options.getWidth(),
                options.getHeight());
            processedFile.setResizedFileName(resizedFileName);
        }

        if (options.isWatermarkEnabled()) {
            String watermarkedFileName = imageService.addWatermark(
                fileName,
                options.getWatermarkText());
            processedFile.setWatermarkedFileName(watermarkedFileName);
        }
    }

    private void processDocumentFile(String fileName,
            ProcessingOptions options,
            ProcessedFile processedFile) {
        if (options.isConvertToPdf()) {
            String pdfFileName = documentService.convertToPdf(fileName);
            processedFile.setConvertedFileName(pdfFileName);
        }

        if (options.isExtractText()) {
            String extractedText = documentService.extractText(fileName);
            processedFile.setExtractedText(extractedText);
        }
    }
}
```

## Real-World Examples

### 1. Document Management System

```java
@Service
@Slf4j
public class DocumentManagementService {
    private final FileStorageService fileStorageService;
    private final FileProcessingService fileProcessingService;
    private final DocumentRepository documentRepository;
    private final SearchService searchService;

    @Transactional
    public Document uploadDocument(MultipartFile file,
            DocumentMetadata metadata) {
        validateDocument(file, metadata);

        String fileName = fileStorageService.storeFile(file);
        Document document = createDocument(file, fileName, metadata);

        ProcessingOptions options = ProcessingOptions.builder()
            .convertToPdf(true)
            .extractText(true)
            .build();

        fileProcessingService.processFile(file, options)
            .thenAccept(processedFile -> {
                document.setPdfVersion(processedFile.getConvertedFileName());
                document.setExtractedText(processedFile.getExtractedText());
                documentRepository.save(document);
                searchService.indexDocument(document);
            });

        return documentRepository.save(document);
    }

    @Transactional(readOnly = true)
    public Page<Document> searchDocuments(String query,
            DocumentFilter filter,
            Pageable pageable) {
        return documentRepository.search(query, filter, pageable);
    }

    @Scheduled(cron = "0 0 2 * * *") // Every day at 2 AM
    @Transactional
    public void archiveOldDocuments() {
        LocalDateTime archiveDate = LocalDateTime.now()
            .minusYears(1);

        List<Document> documentsToArchive = documentRepository
            .findByLastAccessedBefore(archiveDate);

        documentsToArchive.forEach(document -> {
            document.setStatus(DocumentStatus.ARCHIVED);
            fileStorageService.moveToArchive(document.getFileName());
        });

        documentRepository.saveAll(documentsToArchive);
    }
}
```

### 2. Media Processing Service

```java
@Service
@Slf4j
public class MediaProcessingService {
    private final FileStorageService fileStorageService;
    private final ImageService imageService;
    private final VideoService videoService;
    private final MediaRepository mediaRepository;

    @Async
    public CompletableFuture<Media> processMedia(
            MultipartFile file,
            MediaProcessingOptions options) {
        return CompletableFuture.supplyAsync(() -> {
            String fileName = fileStorageService.storeFile(file);
            Media media = createMedia(file, fileName);

            if (isImage(fileName)) {
                processImage(media, fileName, options);
            } else if (isVideo(fileName)) {
                processVideo(media, fileName, options);
            }

            return mediaRepository.save(media);
        });
    }

    private void processImage(Media media,
            String fileName,
            MediaProcessingOptions options) {
        // Generate thumbnails
        if (options.isGenerateThumbnails()) {
            Map<String, String> thumbnails = imageService
                .generateThumbnails(fileName, options.getThumbnailSizes());
            media.setThumbnails(thumbnails);
        }

        // Optimize for web
        if (options.isOptimizeForWeb()) {
            String optimizedFileName = imageService
                .optimizeForWeb(fileName);
            media.setOptimizedVersion(optimizedFileName);
        }
    }

    private void processVideo(Media media,
            String fileName,
            MediaProcessingOptions options) {
        // Generate preview thumbnail
        if (options.isGeneratePreview()) {
            String previewImage = videoService
                .generatePreviewImage(fileName);
            media.setPreviewImage(previewImage);
        }

        // Generate different formats
        if (options.isTranscodeVideo()) {
            Map<String, String> formats = videoService
                .transcodeToFormats(fileName,
                    options.getTargetFormats());
            media.setTranscodedVersions(formats);
        }
    }
}
```

### 3. Backup Service

```java
@Service
@Slf4j
public class BackupService {
    private final FileStorageService fileStorageService;
    private final CloudStorageService cloudStorageService;
    private final CompressionService compressionService;
    private final MetricsService metricsService;

    @Scheduled(cron = "0 0 1 * * *") // Every day at 1 AM
    public void performDailyBackup() {
        log.info("Starting daily backup");
        String backupFileName = generateBackupFileName();

        try {
            // Create backup archive
            String archivePath = compressionService
                .createArchive(fileStorageService.getUploadDir(),
                    backupFileName);

            // Upload to cloud storage
            String cloudUrl = cloudStorageService
                .uploadFile(archivePath,
                    "daily-backups/" + backupFileName);

            // Record metrics
            metricsService.recordBackup(
                "daily",
                Files.size(Paths.get(archivePath)));

            log.info("Daily backup completed: {}", cloudUrl);
        } catch (Exception e) {
            log.error("Backup failed", e);
            notifyAdmins("Daily Backup Failed", e.getMessage());
        }
    }

    @Scheduled(cron = "0 0 2 * * 0") // Every Sunday at 2 AM
    public void cleanupOldBackups() {
        log.info("Starting backup cleanup");

        try {
            LocalDateTime cutoffDate = LocalDateTime.now()
                .minusDays(30);

            List<String> oldBackups = cloudStorageService
                .listFiles("daily-backups")
                .stream()
                .filter(file -> file.getCreatedAt()
                    .isBefore(cutoffDate))
                .map(CloudFile::getName)
                .collect(Collectors.toList());

            oldBackups.forEach(backup -> {
                cloudStorageService.deleteFile(
                    "daily-backups/" + backup);
                log.info("Deleted old backup: {}", backup);
            });

            metricsService.recordCleanup(
                "backups", oldBackups.size());
        } catch (Exception e) {
            log.error("Backup cleanup failed", e);
            notifyAdmins("Backup Cleanup Failed", e.getMessage());
        }
    }
}
```

## Common Pitfalls

1. ❌ Not validating file types
   ✅ Implement strict file type validation

2. ❌ Storing files with original names
   ✅ Generate secure file names

3. ❌ Not handling large files
   ✅ Implement chunked upload/download

4. ❌ Synchronous file processing
   ✅ Use async processing for large files

## Best Practices

1. Validate files thoroughly
2. Use secure file names
3. Implement virus scanning
4. Handle large files properly
5. Process files asynchronously
6. Implement proper error handling
7. Use efficient storage strategies
8. Monitor storage usage

## Knowledge Check

- [ ] Configure file storage
- [ ] Implement file upload/download
- [ ] Process files asynchronously
- [ ] Handle large files
- [ ] Implement security measures
- [ ] Monitor storage usage

## Additional Resources

- [Spring File Upload](https://spring.io/guides/gs/uploading-files/)
- [Spring Resource Handling](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#resources)
- [Apache Commons IO](https://commons.apache.org/proper/commons-io/)
- [Cloud Storage Best Practices](https://cloud.google.com/storage/docs/best-practices)

---

⬅️ Previous: [Scheduling](./25-scheduling.md)

➡️ Next: [Pagination](./27-pagination.md)