# Swagger Schema Tool

The Swagger Schema Tool (`get_swagger_schema`) allows Codefly to fetch and parse
Swagger/OpenAPI schema definitions from URLs. This tool is particularly useful
for understanding API structures, generating API clients, documenting endpoints,
and integrating with external services.

## Overview

The Swagger Schema Tool retrieves Swagger/OpenAPI specifications from a given
URL and can return them in different formats:

- **Summary format** (default): A human-readable overview of the API including
  endpoints, parameters, and models
- **JSON format**: The complete schema in JSON format
- **YAML format**: The complete schema in YAML format

## How to use

### Basic usage

Simply ask Codefly to fetch a Swagger schema:

```
> Fetch the Swagger schema from https://api.example.com/swagger.json
```

### Specify output format

You can request a specific format:

```
> Get the Swagger schema from https://petstore.swagger.io/v2/swagger.json in JSON format
```

```
> Show me a summary of the API endpoints from https://api.example.com/v2/api-docs
```

### Common use cases

#### Understanding an API structure

```
> What endpoints are available in the API at https://api.github.com/swagger.json?
```

#### Generating API documentation

```
> Fetch the Swagger schema from https://api.example.com/swagger.json and create a markdown documentation file
```

#### Comparing API versions

```
> Compare the endpoints between https://api.example.com/v1/swagger.json and https://api.example.com/v2/swagger.json
```

#### Creating API clients

```
> Get the Swagger schema from https://api.example.com/swagger.json and generate a TypeScript client for it
```

## Tool parameters

The `get_swagger_schema` tool accepts the following parameters:

- **`url`** (required): The URL of the Swagger/OpenAPI schema file
  - Examples:
    - `https://api.example.com/swagger.json`
    - `https://api.example.com/v2/api-docs`
    - `https://petstore.swagger.io/v2/swagger.yaml`

- **`format`** (optional): The output format
  - `summary` (default): Human-readable overview with endpoints and models
  - `json`: Full schema in JSON format
  - `yaml`: Full schema in YAML format

## Output format

### Summary format

The summary format provides:

- API title, version, and description
- OpenAPI/Swagger version
- Server URLs or base paths
- List of endpoints with:
  - HTTP method and path
  - Summary and description
  - Operation ID
  - Tags
  - Parameters (name, location, type, required status)
  - Request body information
  - Response codes
- List of model/schema definitions

Example output:

```
API: Petstore API
Version: 1.0.0
Description: This is a sample server Petstore server.

OpenAPI/Swagger Version: 3.0.0
Servers:
  - https://petstore.swagger.io/v2

Endpoints:

GET /pets
  Summary: List all pets
  Operation ID: listPets
  Tags: pets
  Parameters:
    - limit (query, integer)
  Responses: 200, default

POST /pets
  Summary: Create a pet
  Operation ID: createPets
  Tags: pets
  Request Body (required)
  Responses: 201

Models/Schemas:
  - Pet
  - Error
```

### JSON/YAML formats

These formats return the complete Swagger/OpenAPI specification as-is, which is
useful for:

- Importing into API development tools
- Generating code
- Detailed schema analysis
- Integration with other tools

## Supported formats

The tool supports both Swagger 2.0 and OpenAPI 3.x specifications in:

- JSON format (`.json` files or `application/json` content type)
- YAML format (`.yaml` or `.yml` files, or `application/x-yaml`/`text/yaml`
  content types)

The tool automatically detects the format based on the content type header or
file extension.

## Dependencies

The Swagger Schema Tool uses the following optional dependencies:

- **`node-fetch`**: For fetching schemas from URLs (built-in)
- **`js-yaml`**: For parsing YAML format schemas (optional)

If a YAML schema is encountered and `js-yaml` is not installed, the tool will
ask you to install it:

```bash
npm install js-yaml
```

## Security considerations

- The tool fetches schemas from remote URLs, so ensure you trust the source
- Review the fetched schema before using it to generate code or make API calls
- The tool does not execute any code from the fetched schema, it only parses and
  displays the structure

## Examples

### Example 1: Exploring a public API

```
> Fetch the Swagger schema from https://petstore.swagger.io/v2/swagger.json and tell me what endpoints are available
```

Codefly will fetch the schema, parse it, and provide a summary of all available
endpoints.

### Example 2: Generating API client code

```
> Get the Swagger schema from https://api.example.com/v2/api-docs in JSON format, then generate a Python client using the requests library
```

Codefly will fetch the schema in JSON format and use it to generate a Python
client.

### Example 3: API documentation

```
> Fetch the Swagger schema from https://api.example.com/swagger.json and create comprehensive API documentation in markdown format, including all endpoints, parameters, and response schemas
```

Codefly will analyze the schema and generate human-readable documentation.

## Troubleshooting

### "Failed to fetch Swagger schema: 404 Not Found"

The URL you provided does not point to a valid Swagger schema. Common
Swagger/OpenAPI endpoint paths include:

- `/swagger.json`
- `/swagger.yaml`
- `/v2/api-docs` (Springfox/SpringDoc)
- `/openapi.json`
- `/api-docs`

### "Failed to parse Swagger schema"

The content at the URL is not a valid JSON or YAML document. Ensure:

- The URL returns a proper Swagger/OpenAPI specification
- The content type is correct
- The file is not corrupted

### "The 'js-yaml' package is required"

If you're fetching a YAML schema, you need to install js-yaml:

```bash
npm install js-yaml
```

## See also

- [Database Schema Tool](./database-schema.md) - For retrieving database schemas
- [Web Fetch Tool](./web-fetch.md) - For fetching general web content
- [File System Tools](./file-system.md) - For working with local files
