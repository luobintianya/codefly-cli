# Database Schema Tool

The Database Schema Tool (`get_database_schema`) allows Codefly to retrieve
database table structures and column information from MySQL or PostgreSQL
databases. This tool is essential for understanding database schemas, generating
ORMs, creating migrations, and working with database-driven applications.

## Overview

The Database Schema Tool connects to a MySQL or PostgreSQL database and
retrieves comprehensive schema information including:

- Table names
- Column names and data types
- Nullable constraints
- Primary keys and indexes (MySQL)

## How to use

### Basic usage

Ask Codefly to fetch database schema information:

```
> Get the schema for the MySQL database 'myapp_db' on localhost with user 'root'
```

```
> Fetch the PostgreSQL database schema from host db.example.com, database 'production_db', user 'admin'
```

### Common use cases

#### Understanding database structure

```
> What tables exist in the MySQL database 'shop_db' on localhost?
```

#### Generating ORM models

```
> Get the schema from the PostgreSQL database 'app_db' and generate TypeScript TypeORM entities
```

#### Creating database documentation

```
> Fetch the schema from MySQL database 'inventory_db' and create markdown documentation for all tables
```

#### Database migration planning

```
> Get the current schema from the dev database and suggest migrations to match the production schema structure
```

## Tool parameters

The `get_database_schema` tool accepts the following parameters:

- **`type`** (required): Database type
  - `mysql`: For MySQL or MariaDB databases
  - `postgres`: For PostgreSQL databases

- **`host`** (required): Database host address
  - Examples: `localhost`, `127.0.0.1`, `db.example.com`

- **`user`** (required): Username for database connection

- **`database`** (required): Name of the database to query

- **`password`** (optional): Password for database connection
  - If not provided, will attempt connection without password

- **`port`** (optional): Port number
  - Defaults to `3306` for MySQL
  - Defaults to `5432` for PostgreSQL

## Output format

The tool returns a formatted list of tables and their columns:

```
Table: users
- id (int) [PRI]
- username (varchar)
- email (varchar)
- created_at (timestamp) NULL

Table: orders
- id (int) [PRI]
- user_id (int) [MUL]
- total (decimal)
- status (varchar)
- created_at (timestamp)
```

For each column, the output includes:

- Column name
- Data type
- NULL/NOT NULL constraint
- Index information (for MySQL: PRI for primary key, MUL for indexed, etc.)

## Dependencies

The Database Schema Tool requires database client libraries:

### For MySQL/MariaDB

```bash
npm install mysql2
```

### For PostgreSQL

```bash
npm install pg
```

If the required package is not installed, the tool will ask you to install it.

## Security considerations

- **Credentials**: Be cautious when providing database passwords. Consider using
  environment variables or secure credential storage
- **Read-only access**: The tool only reads schema information and does not
  modify data
- **Network security**: Ensure database connections are made over secure
  networks
- **Least privilege**: Use database accounts with minimal required permissions
  (e.g., `SHOW TABLES`, `DESCRIBE` for MySQL, or `pg_catalog` read access for
  PostgreSQL)

## Examples

### Example 1: Local development database

```
> Get the schema from MySQL database 'dev_db' on localhost with user 'root' and no password
```

### Example 2: Remote PostgreSQL database

```
> Connect to PostgreSQL at db.example.com:5432, database 'production_db', user 'readonly', and fetch the complete schema
```

### Example 3: Generating TypeORM entities

```
> Get the schema from MySQL database 'app_db' on localhost and generate TypeORM entities for all tables
```

Codefly will fetch the schema and generate TypeScript classes with appropriate
decorators.

### Example 4: Creating database documentation

```
> Fetch the schema from PostgreSQL database 'analytics_db' and create a comprehensive markdown document describing all tables, their relationships, and fields
```

### Example 5: Schema comparison

```
> Get schemas from both the dev and production databases and show me the differences
```

## Troubleshooting

### "The 'mysql2' package is required"

For MySQL databases, install the mysql2 package:

```bash
npm install mysql2
```

### "The 'pg' package is required"

For PostgreSQL databases, install the pg package:

```bash
npm install pg
```

### "Connection failed"

Common connection issues:

- **Wrong host/port**: Verify the database server address and port
- **Authentication failed**: Check username and password
- **Database doesn't exist**: Ensure the database name is correct
- **Network issues**: Verify firewall rules and network connectivity
- **Permissions**: Ensure the user has permission to access schema information

### "Access denied"

The database user needs appropriate permissions:

For MySQL:

```sql
GRANT SELECT ON information_schema.* TO 'username'@'host';
```

For PostgreSQL:

```sql
GRANT CONNECT ON DATABASE dbname TO username;
GRANT USAGE ON SCHEMA public TO username;
```

## Best practices

1. **Use read-only credentials**: Create database users with minimal required
   permissions
2. **Protect passwords**: Avoid hardcoding passwords in prompts; use environment
   variables when possible
3. **Test connections**: Verify connectivity with a simple query before running
   complex operations
4. **Document schema changes**: Use this tool to track schema evolution over
   time

## See also

- [Swagger Schema Tool](./swagger-schema.md) - For retrieving API schemas
- [File System Tools](./file-system.md) - For working with local schema files
- [Shell Tool](./shell.md) - For running database migration commands
