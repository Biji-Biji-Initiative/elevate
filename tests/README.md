# MS Elevate LEAPS Tracker - Comprehensive Test Suite

This directory contains comprehensive test coverage for the critical business flows of the MS Elevate LEAPS Tracker platform, protecting against regressions as the platform scales.

## Test Architecture

### 📁 Directory Structure
```
tests/
├── README.md                      # This file
├── vitest.config.ts               # Main test configuration
├── setup.ts                       # Global test setup
├── global-setup.ts                # Global test environment setup
├── helpers/
│   └── test-server.ts             # Test server utilities and mocks
├── integration/                   # Integration tests for critical flows
│   ├── 01-submission-approval-flow.test.ts
│   ├── 02-kajabi-webhook-integration.test.ts
│   ├── 03-authentication-authorization.test.ts
│   ├── 04-file-upload-security.test.ts
│   └── 05-database-consistency.test.ts
├── performance/
│   └── performance-benchmarks.test.ts
└── e2e/                           # End-to-end tests (Playwright)
    ├── global-setup.ts
    └── global-teardown.ts
```

## Critical Business Flows Tested

### 🎯 1. Submission Approval Flow (`01-submission-approval-flow.test.ts`)
**Complete end-to-end test of the core business process:**
- ✅ User submits evidence for LEAPS stage
- ✅ Admin reviews and approves/rejects submission
- ✅ Points are correctly awarded based on activity type
- ✅ Leaderboard updates appropriately
- ✅ Audit trail is created for all actions
- ✅ Point adjustments are bounded (±20% of base points)
- ✅ Double approval prevention
- ✅ Bulk approval operations

**Key Test Scenarios:**
- Happy path: submission → approval → points → leaderboard
- Error path: invalid submissions, unauthorized access
- Edge cases: point adjustments, bulk operations
- Security: role-based access control

### 🔗 2. Kajabi Webhook Integration (`02-kajabi-webhook-integration.test.ts`)
**Idempotent webhook processing with comprehensive error handling:**
- ✅ Webhook receives Learn completion events
- ✅ User matching by email (case-insensitive)
- ✅ Idempotent point awarding (no duplicates)
- ✅ Audit trail creation
- ✅ Graceful handling of unknown users
- ✅ Signature verification and security
- ✅ Race condition prevention
- ✅ Malformed payload handling

**Key Test Scenarios:**
- Valid webhook processing and point awarding
- Duplicate webhook idempotency
- Invalid signatures and security violations
- User not found scenarios
- Concurrent webhook processing

### 🔐 3. Authentication & Authorization (`03-authentication-authorization.test.ts`)
**Role-based access control across all endpoints:**
- ✅ Users can only access their own data
- ✅ Role hierarchy enforcement (PARTICIPANT < REVIEWER < ADMIN)
- ✅ Proper 401/403 error responses
- ✅ Session validation and security
- ✅ Role transitions work correctly
- ✅ Audit logging for privileged actions
- ✅ Authorization boundary testing

**Key Test Scenarios:**
- Role hierarchy validation
- Data access boundaries
- Unauthorized access attempts
- Session security and expiration
- Privilege escalation prevention

### 📎 4. File Upload Security (`04-file-upload-security.test.ts`)
**Comprehensive file upload validation and security:**
- ✅ File type validation (PDF/JPG/PNG only)
- ✅ File size limits (5MB maximum)
- ✅ File access control by ownership
- ✅ Malicious file detection and quarantine
- ✅ File hash deduplication
- ✅ Rate limiting and abuse prevention
- ✅ File type spoofing detection
- ✅ Storage quota management

**Key Test Scenarios:**
- Valid file uploads and processing
- Invalid file type rejection
- File size limit enforcement
- Malicious content detection
- Access control violations

### 🗄️ 5. Database Consistency (`05-database-consistency.test.ts`)
**Database integrity and transaction safety:**
- ✅ Foreign key constraints enforcement
- ✅ Unique constraints prevent duplicates
- ✅ Transaction rollback on errors
- ✅ Concurrent transaction handling
- ✅ Data consistency checks
- ✅ Schema validation
- ✅ Performance and indexing
- ✅ Cascade deletion behavior

**Key Test Scenarios:**
- Constraint violation handling
- Transaction isolation and rollback
- Concurrent operation safety
- Data integrity validation
- Performance regression detection

### ⚡ Performance Tests (`performance-benchmarks.test.ts`)
**Critical performance characteristics testing:**
- ✅ Database query performance (< 50ms for fast queries)
- ✅ API endpoint response times (< 200ms)
- ✅ Leaderboard calculation (< 500ms)
- ✅ Concurrent request handling (< 1000ms)
- ✅ Bulk operations (< 2000ms)
- ✅ Memory leak detection
- ✅ Resource usage monitoring

**Performance Thresholds:**
- Fast queries: 50ms
- API responses: 200ms
- Leaderboard: 500ms
- Bulk operations: 2s
- Concurrent load: 1s

## Test Infrastructure

### 🛠️ Test Database (`packages/db/tests/helpers.ts`)
**Isolated test environment with:**
- Automatic setup and teardown
- Comprehensive test data factories
- Database health monitoring
- Transaction rollback support
- Performance measurement tools

### 🎭 Mock Services (`tests/helpers/test-server.ts`)
**Complete mocking infrastructure:**
- Authentication and authorization mocks
- File upload simulation
- Webhook signature generation
- API request/response handling
- External service mocking

### 📊 Coverage Requirements
**Quality gates enforced:**
- 80% minimum code coverage
- All critical paths tested
- Error scenarios covered
- Security boundaries validated
- Performance thresholds met

## Running Tests

### 🏃‍♂️ Local Development
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run integration tests only
pnpm test:integration

# Run performance tests
pnpm test:performance

# Watch mode for development
pnpm test:watch

# Run specific test file
pnpm test tests/integration/01-submission-approval-flow.test.ts
```

### 🔄 CI/CD Pipeline
The test suite is integrated into GitHub Actions with multiple jobs:

1. **Test Job** - Runs on Node.js 18.x and 20.x
2. **Security Scan** - Dependency audit and secret scanning
3. **Build Check** - Ensures all packages build correctly
4. **E2E Tests** - Full browser testing (PR only)
5. **Performance** - Benchmark tracking (main branch only)
6. **Quality Gates** - Enforces all checks pass

### 📈 Test Results and Reporting
- **Coverage Reports**: Uploaded to Codecov
- **Test Results**: JUnit XML for CI integration
- **Performance Metrics**: JSON reports for trend analysis
- **Playwright Reports**: Visual test results for E2E

## Security Testing

### 🛡️ Security Validations
- **Input Validation**: Zod schema validation
- **SQL Injection**: Parameterized queries
- **File Upload**: Malicious file detection
- **Authentication**: JWT validation and expiry
- **Authorization**: Role-based access control
- **Rate Limiting**: Request throttling
- **CSRF Protection**: Token validation

### 🔍 Vulnerability Scanning
- Dependency audit on every CI run
- Secret scanning for exposed keys
- Code quality analysis
- Security headers validation

## Monitoring and Alerting

### 📊 Test Metrics Tracked
- Test execution time trends
- Coverage percentage changes
- Performance regression detection
- Failure rate analysis
- Flaky test identification

### 🚨 Alert Thresholds
- Coverage drops below 80%
- Performance degrades beyond thresholds
- Critical test failures
- Security vulnerabilities detected

## Best Practices

### ✅ Writing Tests
1. **Isolation**: Each test has clean state
2. **Deterministic**: Tests produce consistent results
3. **Fast**: Unit tests complete quickly
4. **Comprehensive**: Cover happy path, errors, and edge cases
5. **Maintainable**: Clear naming and documentation

### 🔧 Test Maintenance
1. **Regular Updates**: Keep pace with code changes
2. **Performance Monitoring**: Track test execution trends
3. **Flaky Test Resolution**: Fix unreliable tests immediately
4. **Coverage Analysis**: Identify untested code paths
5. **Security Updates**: Keep testing dependencies current

## Troubleshooting

### 🐛 Common Issues

**Database Connection Errors:**
```bash
# Check database is running
pnpm db:studio

# Reset test database
pnpm db:reset
pnpm db:seed
```

**Mock Failures:**
```bash
# Clear all mocks
vi.clearAllMocks()

# Check mock implementations
expect(mockFunction).toHaveBeenCalledWith(expectedArgs)
```

**Timeout Issues:**
```bash
# Increase timeout for slow tests
test('slow operation', async () => {
  // test code
}, 30000) // 30 second timeout
```

### 📝 Debug Commands
```bash
# Run with debug output
DEBUG=* pnpm test

# Run single test with verbose output
pnpm test --reporter=verbose tests/integration/01-submission-approval-flow.test.ts

# Check test coverage details
pnpm test:coverage --reporter=html
open coverage/index.html
```

## Contributing

### 🤝 Adding New Tests
1. Create test file in appropriate directory
2. Follow naming convention: `feature-name.test.ts`
3. Include setup/teardown for isolation
4. Test both success and failure scenarios
5. Add performance assertions for critical paths
6. Update this README if adding new test categories

### 📋 Test Review Checklist
- [ ] Tests are isolated and independent
- [ ] Both positive and negative cases covered
- [ ] Performance thresholds appropriate
- [ ] Security boundaries tested
- [ ] Error messages descriptive
- [ ] Mocks properly configured
- [ ] Database cleanup handled
- [ ] CI integration working

## Future Enhancements

### 🚀 Planned Improvements
1. **Visual Regression Testing**: Screenshot comparison
2. **Load Testing**: Large-scale performance validation
3. **Chaos Engineering**: System resilience testing
4. **A/B Testing**: Statistical validation framework
5. **Mobile Testing**: Responsive design validation

### 🎯 Quality Goals
- Achieve 95% code coverage
- Sub-100ms API response times
- Zero security vulnerabilities
- 99.9% test reliability
- Full automation of quality gates

---

*This test suite ensures the MS Elevate LEAPS Tracker maintains quality and reliability as it scales to support thousands of educators across Indonesia.*