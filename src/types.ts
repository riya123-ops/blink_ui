import {
  defaultDatabaseDrivers,
  defaultDatabaseTypes,
  selectedIds as selectedDatabaseIds,
} from './databaseTypes'
import {
  defaultFrontendAddons,
  defaultFrontendStack,
  selectedFrontendIds,
  shouldScaffoldFrontend,
} from './frontendTechnologies'
import {
  defaultLibrariesForLanguage,
  selectedLibraryIds,
} from './languageLibraries'

export type ProjectType = 'new' | 'existing'
export type BuildTool = 'gradle-groovy' | 'gradle-kotlin' | 'maven'
export type BackendLanguage = 'python' | 'java' | 'nodejs' | 'go'
export type BackendFramework = 'python' | 'java-spring' | 'nodejs-express' | 'go-gin'
export type ConfigFormat = 'yaml' | 'properties'

export interface SetupForm {
  projectType: ProjectType
  buildTool: BuildTool
  backendLanguage: BackendLanguage
  springBootVersion: string
  frontendStack: Record<string, boolean>
  frontendLibraries: Record<string, boolean>
  backendFramework: BackendFramework
  backendLibraries: Record<string, boolean>
  databaseTypes: Record<string, boolean>
  databaseDrivers: Record<string, boolean>
  projectName: string
  artifactName: string
  version: string
  description: string
  configFormat: ConfigFormat
  packageNamespace: string
  pythonPackageName: string
  baEmail: string
  poEmail: string
  securityEmail: string
}

export const defaultForm: SetupForm = {
  projectType: 'new',
  buildTool: 'gradle-groovy',
  backendLanguage: 'java',
  springBootVersion: '3.4.1',
  frontendStack: defaultFrontendStack(),
  frontendLibraries: defaultFrontendAddons(),
  backendFramework: 'java-spring',
  backendLibraries: defaultLibrariesForLanguage('java'),
  databaseTypes: defaultDatabaseTypes(),
  databaseDrivers: defaultDatabaseDrivers('java', defaultDatabaseTypes()),
  projectName: '',
  artifactName: '',
  version: '0.1.0',
  description: '',
  configFormat: 'yaml',
  packageNamespace: '',
  pythonPackageName: '',
  baEmail: '',
  poEmail: '',
  securityEmail: '',
}

export function toApiPayload(form: SetupForm) {
  const frontendTech = selectedFrontendIds(form.frontendStack)
  const scaffoldFrontend = shouldScaffoldFrontend(form.frontendStack)

  return {
    project_type: form.projectType,
    build_tool: form.buildTool,
    backend_language: form.backendLanguage,
    spring_boot_version: form.springBootVersion,
    frontend_technologies: frontendTech,
    frontend_libraries: scaffoldFrontend ? selectedFrontendIds(form.frontendLibraries) : [],
    frontend_react_vite: Boolean(form.frontendStack.react && form.frontendStack.vite),
    backend_framework: form.backendFramework,
    backend_libraries: selectedLibraryIds(form.backendLibraries),
    database_types: selectedDatabaseIds(form.databaseTypes),
    database_drivers: selectedDatabaseIds(form.databaseDrivers),
    project_name: form.projectName,
    artifact_name: form.artifactName,
    version: form.version,
    description: form.description,
    config_format: form.configFormat,
    package_namespace: form.packageNamespace,
    python_package_name: form.pythonPackageName,
    ba_email: form.baEmail,
    po_email: form.poEmail,
    security_email: form.securityEmail,
    workspace_structure: 'multi-repo',
  }
}
