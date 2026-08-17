import type { BackendLanguage } from './types'

export interface DatabaseOption {
  id: string
  label: string
  description?: string
  defaultSelected?: boolean
}

export const DATABASE_TYPES: DatabaseOption[] = [
  { id: 'postgresql', label: 'PostgreSQL', defaultSelected: true },
  { id: 'mysql', label: 'MySQL' },
  { id: 'mariadb', label: 'MariaDB' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'mongodb', label: 'MongoDB' },
  { id: 'redis', label: 'Redis' },
  { id: 'sqlserver', label: 'SQL Server' },
  { id: 'oracle', label: 'Oracle' },
  { id: 'dynamodb', label: 'DynamoDB' },
  { id: 'elasticsearch', label: 'Elasticsearch' },
  { id: 'cassandra', label: 'Cassandra' },
  { id: 'firebase', label: 'Firebase / Firestore' },
]

/** Drivers/ORM clients shown when a database type is selected, keyed by backend language. */
export const DATABASE_DRIVERS: Record<BackendLanguage, Record<string, DatabaseOption[]>> = {
  python: {
    postgresql: [
      { id: 'psycopg', label: 'psycopg (PostgreSQL)', defaultSelected: true },
      { id: 'asyncpg', label: 'asyncpg' },
    ],
    mysql: [
      { id: 'pymysql', label: 'PyMySQL', defaultSelected: true },
      { id: 'mysqlclient', label: 'mysqlclient' },
    ],
    mariadb: [{ id: 'pymysql', label: 'PyMySQL (MariaDB)', defaultSelected: true }],
    sqlite: [{ id: 'sqlite3', label: 'sqlite3 (stdlib)', defaultSelected: true }],
    mongodb: [
      { id: 'pymongo', label: 'PyMongo', defaultSelected: true },
      { id: 'motor', label: 'Motor (async)' },
    ],
    redis: [{ id: 'redis-py', label: 'redis-py', defaultSelected: true }],
    sqlserver: [{ id: 'pyodbc', label: 'pyodbc', defaultSelected: true }],
    oracle: [{ id: 'cx-oracle', label: 'cx_Oracle', defaultSelected: true }],
    dynamodb: [{ id: 'boto3-dynamodb', label: 'boto3 (DynamoDB)', defaultSelected: true }],
    elasticsearch: [{ id: 'elasticsearch-py', label: 'elasticsearch-py', defaultSelected: true }],
    cassandra: [{ id: 'cassandra-driver', label: 'cassandra-driver', defaultSelected: true }],
    firebase: [{ id: 'firebase-admin', label: 'firebase-admin', defaultSelected: true }],
  },
  java: {
    postgresql: [{ id: 'jdbc-postgresql', label: 'JDBC PostgreSQL', defaultSelected: true }],
    mysql: [{ id: 'jdbc-mysql', label: 'JDBC MySQL', defaultSelected: true }],
    mariadb: [{ id: 'jdbc-mariadb', label: 'JDBC MariaDB', defaultSelected: true }],
    sqlite: [{ id: 'jdbc-sqlite', label: 'JDBC SQLite', defaultSelected: true }],
    mongodb: [{ id: 'mongodb-java', label: 'MongoDB Java Driver', defaultSelected: true }],
    redis: [{ id: 'jedis', label: 'Jedis', defaultSelected: true }],
    sqlserver: [{ id: 'jdbc-sqlserver', label: 'JDBC SQL Server', defaultSelected: true }],
    oracle: [{ id: 'jdbc-oracle', label: 'JDBC Oracle', defaultSelected: true }],
    dynamodb: [{ id: 'aws-sdk-dynamodb', label: 'AWS SDK DynamoDB', defaultSelected: true }],
    elasticsearch: [{ id: 'elasticsearch-java', label: 'Elasticsearch Java Client', defaultSelected: true }],
    cassandra: [{ id: 'java-driver-cassandra', label: 'DataStax Java Driver', defaultSelected: true }],
    firebase: [{ id: 'firebase-admin-java', label: 'Firebase Admin SDK', defaultSelected: true }],
  },
  nodejs: {
    postgresql: [
      { id: 'pg', label: 'pg (node-postgres)', defaultSelected: true },
      { id: 'sequelize', label: 'Sequelize' },
    ],
    mysql: [
      { id: 'mysql2', label: 'mysql2', defaultSelected: true },
      { id: 'sequelize', label: 'Sequelize' },
    ],
    mariadb: [{ id: 'mariadb', label: 'mariadb driver', defaultSelected: true }],
    sqlite: [{ id: 'better-sqlite3', label: 'better-sqlite3', defaultSelected: true }],
    mongodb: [
      { id: 'mongoose', label: 'Mongoose', defaultSelected: true },
      { id: 'mongodb', label: 'MongoDB Node Driver' },
    ],
    redis: [{ id: 'ioredis', label: 'ioredis', defaultSelected: true }],
    sqlserver: [{ id: 'mssql', label: 'mssql (tedious)', defaultSelected: true }],
    oracle: [{ id: 'oracledb', label: 'node-oracledb', defaultSelected: true }],
    dynamodb: [{ id: 'aws-sdk-dynamodb-js', label: '@aws-sdk/client-dynamodb', defaultSelected: true }],
    elasticsearch: [{ id: 'elastic-js', label: '@elastic/elasticsearch', defaultSelected: true }],
    cassandra: [{ id: 'cassandra-driver-js', label: 'cassandra-driver', defaultSelected: true }],
    firebase: [{ id: 'firebase-admin-js', label: 'firebase-admin', defaultSelected: true }],
  },
  go: {
    postgresql: [
      { id: 'pgx', label: 'pgx', defaultSelected: true },
      { id: 'gorm-postgres', label: 'GORM (PostgreSQL)' },
    ],
    mysql: [{ id: 'go-sql-driver-mysql', label: 'go-sql-driver/mysql', defaultSelected: true }],
    mariadb: [{ id: 'go-sql-driver-mysql', label: 'go-sql-driver/mysql', defaultSelected: true }],
    sqlite: [{ id: 'modernc-sqlite', label: 'modernc.org/sqlite', defaultSelected: true }],
    mongodb: [{ id: 'mongo-go', label: 'mongo-go-driver', defaultSelected: true }],
    redis: [{ id: 'go-redis', label: 'go-redis', defaultSelected: true }],
    sqlserver: [{ id: 'go-mssqldb', label: 'go-mssqldb', defaultSelected: true }],
    oracle: [{ id: 'go-ora', label: 'go-ora', defaultSelected: true }],
    dynamodb: [{ id: 'aws-sdk-go-dynamodb', label: 'AWS SDK Go (DynamoDB)', defaultSelected: true }],
    elasticsearch: [{ id: 'elastic-go', label: 'go-elasticsearch', defaultSelected: true }],
    cassandra: [{ id: 'gocql', label: 'gocql', defaultSelected: true }],
    firebase: [{ id: 'firebase-go', label: 'Firebase Admin Go', defaultSelected: true }],
  },
}

export function defaultDatabaseTypes(): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  for (const db of DATABASE_TYPES) {
    selected[db.id] = Boolean(db.defaultSelected)
  }
  return selected
}

export function defaultDatabaseDrivers(
  language: BackendLanguage,
  databaseTypes: Record<string, boolean>,
): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  const driversByLang = DATABASE_DRIVERS[language]

  for (const [dbId, enabled] of Object.entries(databaseTypes)) {
    if (!enabled) continue
    for (const driver of driversByLang[dbId] ?? []) {
      if (driver.defaultSelected) {
        selected[driver.id] = true
      }
    }
  }
  return selected
}

export function visibleDatabaseDrivers(
  language: BackendLanguage,
  databaseTypes: Record<string, boolean>,
): DatabaseOption[] {
  const seen = new Set<string>()
  const drivers: DatabaseOption[] = []
  const driversByLang = DATABASE_DRIVERS[language]

  for (const [dbId, enabled] of Object.entries(databaseTypes)) {
    if (!enabled) continue
    for (const driver of driversByLang[dbId] ?? []) {
      if (!seen.has(driver.id)) {
        seen.add(driver.id)
        drivers.push(driver)
      }
    }
  }
  return drivers
}

export function selectedIds(map: Record<string, boolean>): string[] {
  return Object.entries(map)
    .filter(([, on]) => on)
    .map(([id]) => id)
}
