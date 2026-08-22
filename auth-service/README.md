# OmniCart Auth Service

Authentication and authorization service for OmniCart, built with NestJS, MongoDB, JWT, Passport, and bcrypt.

## Features

- Customer registration with DTO validation and bcrypt password hashing
- Login with short-lived access tokens
- HTTP-only refresh-token cookies with token rotation
- JWT-protected current-user and logout endpoints
- Role guard and `@Roles()` decorator for authorization rules
- Swagger API documentation

## Prerequisites

- Node.js 20 or newer
- npm
- A reachable MongoDB-compatible database

## Setup

From this directory:

```bash
npm install
```

Create a `.env` file in the project root. Use a MongoDB connection string and strong, different secrets for access and refresh tokens:

```env
MONGODB_URI=mongodb://localhost:27017/omnicart
JWT_ACCESS_SECRET=replace-with-a-long-access-secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=replace-with-a-long-refresh-secret
JWT_REFRESH_EXPIRATION=7d
NODE_ENV=development
PORT=3000
```

Never commit `.env` or real credentials. Keep secrets in your deployment environment or a secret manager.

## Run

```bash
# Start once
npm run start

# Start with file watching
npm run start:dev

# Build and run the compiled application
npm run build
npm run start:prod
```

The service listens on `http://localhost:3000` by default. Set `PORT` to use another port.

Swagger UI is available at:

```text
http://localhost:3000/api/docs
```

## API

### Register

`POST /auth/register`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password@123"
}
```

Passwords must be 8-100 characters and include uppercase, lowercase, numeric, and special characters. A successful request returns the created user without password data.

### Login

`POST /auth/login`

```json
{
  "email": "jane@example.com",
  "password": "Password@123"
}
```

The response contains an `accessToken`. The service also sets an HTTP-only `refreshToken` cookie. Clients must retain that cookie for refresh and logout flows.

### Refresh access token

`POST /auth/refresh`

Send the `refreshToken` cookie. A successful request returns a new access token and rotates the refresh-token cookie.

### Get the current user

`GET /auth/me`

Send the access token as a bearer token:

```http
Authorization: Bearer <access-token>
```

### Logout

`POST /auth/logout`

Requires a bearer access token. The stored refresh-token hash is cleared and the refresh cookie is removed.

### Roles

Available user roles are `CUSTOMER`, `ADMIN`, and `SUPPORT_AGENT`. Use `@Roles(...)` together with `RolesGuard` on endpoints that require specific roles.

## Testing

Run unit tests:

```bash
npm test
```

Run unit tests in watch mode:

```bash
npm run test:watch
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Generate a coverage report:

```bash
npm run test:cov
```

Run linting and formatting checks:

```bash
npm run lint
npm run format
```

The unit tests mock persistence. The auth e2e tests boot a Nest HTTP application and exercise validation, JWT/Passport guards, cookies, login, refresh, profile, and logout behavior without requiring a live MongoDB connection.

## Project structure

```text
src/
  auth/
    decorators/       Role metadata decorator
    dto/               Register and login validation DTOs
    guards/            JWT and role guards
    strategies/        Passport JWT strategy
    auth.controller.ts Authentication routes
    auth.service.ts    Authentication business logic
  users/
    schemas/           Mongoose user schema
    users.service.ts   User persistence operations
test/                  End-to-end tests
```

## Security notes

- Access tokens are sent in the `Authorization` header.
- Refresh tokens are stored in an HTTP-only cookie and only their bcrypt hashes are stored in MongoDB.
- Refresh tokens are rotated after successful use.
- In production, cookies are marked `Secure`; serve the service over HTTPS.
- Use strong secrets and do not reuse the access-token secret for refresh tokens.
