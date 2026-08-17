export const APPLICATION_TYPES = [
  { id: 'backend-api', label: 'Backend / API' },
  { id: 'web-application', label: 'Web Application' },
  { id: 'mobile-application', label: 'Mobile Application' },
  { id: 'desktop-application', label: 'Desktop Application' },
  { id: 'ai-ml', label: 'AI / ML Application' },
  { id: 'microservice', label: 'Microservice' },
  { id: 'other', label: 'Other' },
] as const

export const LANGUAGES = [
  { id: 'java', label: 'Java' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'csharp', label: 'C#' },
  { id: 'go', label: 'Go' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'php', label: 'PHP' },
] as const

export const JAVA_VERSIONS = ['21', '17', '11']
export const SPRING_BOOT_VERSIONS = ['4.1.0', '3.4.1', '3.3.5']
export const PACKAGING_OPTIONS = [
  { id: 'jar', label: 'Jar' },
  { id: 'war', label: 'War' },
] as const

export const ORM_OPTIONS_JAVA = [
  { id: 'spring-data-jpa', label: 'Spring Data JPA / Hibernate' },
  { id: 'mybatis', label: 'MyBatis' },
  { id: 'jdbc', label: 'Spring JDBC' },
]

export const API_OPTIONS = [
  { id: 'rest', label: 'REST / OpenAPI' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'grpc', label: 'gRPC' },
]

export const SECURITY_OPTIONS_JAVA = [
  { id: 'spring-security', label: 'Spring Security' },
  { id: 'oauth2-oidc', label: 'OAuth2 / OIDC' },
  { id: 'jwt', label: 'JWT' },
  { id: 'none', label: 'None (dev only)' },
]

export const TESTING_OPTIONS_JAVA = [
  { id: 'junit-mockito', label: 'JUnit 5 + Mockito' },
  { id: 'testcontainers', label: 'Testcontainers' },
  { id: 'spring-test', label: 'Spring Boot Test' },
]

export function languagesForAppType(appType: string): string[] {
  switch (appType) {
    case 'backend-api':
    case 'microservice':
      return ['java', 'python', 'go', 'kotlin', 'csharp']
    case 'web-application':
      return ['java', 'python', 'javascript', 'typescript', 'csharp']
    case 'mobile-application':
      return ['kotlin', 'javascript', 'typescript', 'csharp']
    case 'ai-ml':
      return ['python', 'java', 'javascript']
    default:
      return LANGUAGES.map((l) => l.id)
  }
}

export function frameworksForLanguage(lang: string): { id: string; label: string }[] {
  switch (lang) {
    case 'java':
      return [{ id: 'spring-boot', label: 'Spring Boot' }]
    case 'python':
      return [
        { id: 'fastapi', label: 'FastAPI' },
        { id: 'django', label: 'Django' },
        { id: 'flask', label: 'Flask' },
      ]
    case 'javascript':
    case 'typescript':
      return [
        { id: 'express', label: 'Express' },
        { id: 'nestjs', label: 'NestJS' },
      ]
    case 'go':
      return [{ id: 'gin', label: 'Gin' }]
    case 'kotlin':
      return [{ id: 'spring-boot', label: 'Spring Boot (Kotlin)' }]
    default:
      return [{ id: 'generic', label: 'Generic Framework' }]
  }
}
