#!/usr/bin/env node

/**
 * Comprehensive Environment Validation Script
 * MS Elevate LEAPS Tracker - Validates all environment variables with patterns, formats, and CI/CD support
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Configuration for validation rules
const ENV_RULES = {
  // Critical variables that must be present and valid in all environments
  CRITICAL: {
    DATABASE_URL: {
      required: true,
      pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+(\\?.*)?$/,
      description: 'PostgreSQL connection string',
      example: 'postgresql://user:password@host:5432/database'
    },
    DIRECT_URL: {
      required: true,
      pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+(\\?.*)?$/,
      description: 'Direct PostgreSQL connection for migrations',
      example: 'postgresql://user:password@host:5432/database'
    },
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {
      required: true,
      pattern: /^pk_(test|live)_[A-Za-z0-9]{24,}$/,
      description: 'Clerk publishable key',
      example: 'pk_test_abcd1234...'
    },
    CLERK_SECRET_KEY: {
      required: true,
      pattern: /^sk_(test|live)_[A-Za-z0-9]{24,}$/,
      description: 'Clerk secret key',
      sensitive: true,
      example: 'sk_test_abcd1234...'
    },
    NEXT_PUBLIC_SUPABASE_URL: {
      required: true,
      pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
      description: 'Supabase project URL',
      example: 'https://project.supabase.co'
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      required: true,
      pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
      description: 'Supabase anonymous key (JWT)',
      example: 'eyJ...'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      required: true,
      pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
      description: 'Supabase service role key (JWT)',
      sensitive: true,
      example: 'eyJ...'
    },
    NEXT_PUBLIC_SITE_URL: {
      required: true,
      pattern: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
      description: 'Application public URL',
      example: 'https://leaps.mereka.org'
    }
  },

  // Integration variables (required in production, optional in development)
  INTEGRATIONS: {
    KAJABI_WEBHOOK_SECRET: {
      required: ['production'],
      pattern: /^[A-Za-z0-9_-]{32,}$/,
      description: 'Kajabi webhook verification secret',
      sensitive: true,
      example: 'whsec_abcd1234...'
    },
    KAJABI_API_KEY: {
      required: ['production'],
      pattern: /^[A-Za-z0-9_-]{16,}$/,
      description: 'Kajabi API access key',
      sensitive: true,
      example: 'ka_abcd1234...'
    },
    KAJABI_CLIENT_SECRET: {
      required: ['production'],
      pattern: /^[A-Za-z0-9_-]{16,}$/,
      description: 'Kajabi OAuth client secret',
      sensitive: true,
      example: 'cs_abcd1234...'
    },
    CLERK_WEBHOOK_SECRET: {
      required: ['production'],
      pattern: /^whsec_[A-Za-z0-9_-]{24,}$/,
      description: 'Clerk webhook verification secret',
      sensitive: true,
      example: 'whsec_abcd1234...'
    },
    RESEND_API_KEY: {
      required: false,
      pattern: /^re_[A-Za-z0-9_-]{16,}$/,
      description: 'Resend email service API key',
      sensitive: true,
      example: 're_abcd1234...'
    },
    OPENAI_API_KEY: {
      required: false,
      pattern: /^sk-[A-Za-z0-9_-]{48,}$/,
      description: 'OpenAI API key for AI features',
      sensitive: true,
      example: 'sk-abcd1234...'
    },
    SENTRY_DSN: {
      required: false,
      pattern: /^https:\/\/[a-f0-9]+@[a-f0-9]+\.ingest\.sentry\.io\/\d+$/,
      description: 'Sentry error tracking DSN',
      example: 'https://abc123@def456.ingest.sentry.io/789'
    }
  },

  // Application configuration with defaults
  APPLICATION: {
    NODE_ENV: {
      required: true,
      pattern: /^(development|staging|production|test)$/,
      description: 'Node.js environment',
      defaultValue: 'development'
    },
    RATE_LIMIT_RPM: {
      required: false,
      pattern: /^\d+$/,
      description: 'API rate limit per minute',
      defaultValue: '60'
    },
    WEBHOOK_RATE_LIMIT_RPM: {
      required: false,
      pattern: /^\d+$/,
      description: 'Webhook rate limit per minute',
      defaultValue: '120'
    },
    DATABASE_POOL_MAX: {
      required: false,
      pattern: /^\d+$/,
      description: 'Database connection pool max size',
      defaultValue: '10'
    },
    DATABASE_POOL_TIMEOUT: {
      required: false,
      pattern: /^\d+$/,
      description: 'Database connection timeout (ms)',
      defaultValue: '30000'
    },
    DEBUG: {
      required: false,
      pattern: /^(true|false)$/,
      description: 'Enable debug logging',
      defaultValue: 'false'
    },
    FROM_EMAIL: {
      required: false,
      pattern: /^.+@.+\..+$/,
      description: 'Default from email address',
      defaultValue: 'MS Elevate <noreply@leaps.mereka.org>'
    },
    REPLY_TO_EMAIL: {
      required: false,
      pattern: /^.+@.+\..+$/,
      description: 'Default reply-to email address',
      defaultValue: 'support@leaps.mereka.org'
    }
  },

  // Optional services and development tools
  OPTIONAL: {
    TURBO_TOKEN: {
      required: false,
      pattern: /^[A-Za-z0-9_-]+$/,
      description: 'Turbo remote cache token',
      sensitive: true,
      example: 'turbo_token_abcd1234...'
    },
    CRON_SECRET: {
      required: false,
      pattern: /^[A-Za-z0-9_-]{16,}$/,
      description: 'Secret for cron job authentication',
      sensitive: true,
      example: 'cron_secret_abcd1234...'
    },
    ANALYTICS_API_KEY: {
      required: false,
      pattern: /^[A-Za-z0-9_-]{16,}$/,
      description: 'Analytics service API key',
      sensitive: true,
      example: 'analytics_key_abcd1234...'
    }
  }
};

// Required environment files
const REQUIRED_FILES = [
  '.env.defaults',
  '.env.development', 
  '.env.staging',
  '.env.production'
];

class EnvironmentValidator {
  constructor(options = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.silent = options.silent || false;
    this.ciMode = options.ci || process.env.CI === 'true';
    this.strict = options.strict || false;
    this.errors = [];
    this.warnings = [];
    this.envRoot = process.cwd();
  }

  log(message) {
    if (!this.silent) {
      console.log(message);
    }
  }

  error(message, code = 'ENV_ERROR') {
    this.errors.push({ message, code, category: 'error' });
    if (!this.silent) {
      console.error(`❌ ${message}`);
    }
  }

  warn(message, code = 'ENV_WARNING') {
    this.warnings.push({ message, code, category: 'warning' });
    if (!this.silent) {
      console.warn(`⚠️  ${message}`);
    }
  }

  success(message) {
    if (!this.silent) {
      console.log(`✅ ${message}`);
    }
  }

  validateFiles() {
    this.log('📁 Checking environment files:');
    let allFilesExist = true;

    REQUIRED_FILES.forEach(file => {
      const filePath = path.join(this.envRoot, file);
      const exists = fs.existsSync(filePath);
      
      if (exists) {
        this.success(`${file}`);
      } else {
        this.error(`Missing required file: ${file}`, 'MISSING_FILE');
        allFilesExist = false;
      }
    });

    return allFilesExist;
  }

  loadEnvironment() {
    this.log('\n🔧 Loading environment variables:');
    
    // Load in dotenv precedence order
    const nodeEnv = process.env.NODE_ENV || this.environment;
    const envFiles = [
      '.env.local',
      `.env.${nodeEnv}.local`,
      `.env.${nodeEnv}`,
      '.env.defaults'
    ];

    envFiles.forEach(file => {
      const filePath = path.join(this.envRoot, file);
      if (fs.existsSync(filePath)) {
        require('dotenv').config({ path: filePath });
        this.log(`  Loaded: ${file}`);
      }
    });
  }

  isPlaceholder(value) {
    if (!value) return true;
    const placeholderPatterns = [
      'placeholder',
      'your-',
      'replace-me',
      'change-me',
      'example',
      'test_placeholder',
      'demo-'
    ];
    
    const lowerValue = value.toLowerCase();
    return placeholderPatterns.some(pattern => lowerValue.includes(pattern));
  }

  validateVariable(name, rule) {
    const value = process.env[name];
    const isRequired = this.isVariableRequired(rule);
    const isPlaceholder = this.isPlaceholder(value);

    // Check if required variable is missing or placeholder
    if (isRequired) {
      if (!value) {
        this.error(`Missing required variable: ${name}`, 'MISSING_REQUIRED');
        return false;
      }
      
      if (isPlaceholder) {
        this.error(`Variable ${name} contains placeholder value: ${this.maskValue(value, rule)}`, 'PLACEHOLDER_VALUE');
        return false;
      }
    }

    // Check pattern if value exists and is not placeholder
    if (value && !isPlaceholder && rule.pattern) {
      if (!rule.pattern.test(value)) {
        this.error(`Invalid format for ${name}: expected ${rule.description}`, 'INVALID_FORMAT');
        if (rule.example) {
          this.log(`  Example: ${rule.example}`);
        }
        return false;
      }
    }

    // Special URL validation
    if (value && !isPlaceholder && name.includes('URL')) {
      try {
        new URL(value);
      } catch {
        this.error(`Invalid URL format for ${name}: ${this.maskValue(value, rule)}`, 'INVALID_URL');
        return false;
      }
    }

    return true;
  }

  isVariableRequired(rule) {
    if (typeof rule.required === 'boolean') {
      return rule.required;
    }
    if (Array.isArray(rule.required)) {
      return rule.required.includes(this.environment);
    }
    return false;
  }

  maskValue(value, rule) {
    if (!value) return 'NOT SET';
    if (rule.sensitive) {
      return value.length > 8 ? 
        `${value.substring(0, 4)}***${value.substring(value.length - 4)}` : 
        '***masked***';
    }
    return value;
  }

  validateCategory(categoryName, rules) {
    this.log(`\n🔐 Checking ${categoryName.toLowerCase()} variables:`);
    let categoryValid = true;

    Object.entries(rules).forEach(([name, rule]) => {
      const isValid = this.validateVariable(name, rule);
      const value = process.env[name];
      
      if (isValid && value && !this.isPlaceholder(value)) {
        this.success(`${name}: ${this.maskValue(value, rule)}`);
      } else if (value && this.isPlaceholder(value)) {
        this.warn(`${name}: placeholder value detected`);
      } else if (!value && !this.isVariableRequired(rule)) {
        this.log(`  ℹ️  ${name}: optional, not set`);
      }
      
      if (!isValid) categoryValid = false;
    });

    return categoryValid;
  }

  validateAllVariables() {
    let allValid = true;

    // Validate each category
    Object.entries(ENV_RULES).forEach(([category, rules]) => {
      const categoryValid = this.validateCategory(category, rules);
      if (!categoryValid) allValid = false;
    });

    return allValid;
  }

  generateSummary() {
    this.log('\n📊 Environment Summary:');
    this.log(`  Environment: ${this.environment}`);
    this.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    this.log(`  Site URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'not set'}`);
    
    // Count configured services
    const configuredServices = Object.entries(ENV_RULES.INTEGRATIONS).filter(([name, rule]) => {
      const value = process.env[name];
      return value && !this.isPlaceholder(value);
    }).length;
    
    this.log(`  Configured integrations: ${configuredServices}/${Object.keys(ENV_RULES.INTEGRATIONS).length}`);
  }

  generateReport() {
    const report = {
      environment: this.environment,
      timestamp: new Date().toISOString(),
      status: this.errors.length === 0 ? 'valid' : 'invalid',
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        totalVariables: Object.values(ENV_RULES).reduce((sum, rules) => sum + Object.keys(rules).length, 0)
      },
      errors: this.errors,
      warnings: this.warnings
    };

    return report;
  }

  run() {
    if (!this.silent) {
      console.log('🔍 MS Elevate Environment Validation\n');
      console.log(`Environment: ${this.environment}`);
      console.log(`CI Mode: ${this.ciMode}`);
      console.log(`Strict Mode: ${this.strict}\n`);
    }

    // Step 1: Check environment files exist
    const filesExist = this.validateFiles();
    if (!filesExist && this.strict) {
      this.error('Missing required environment files in strict mode');
      return this.generateReport();
    }

    // Step 2: Load environment variables
    this.loadEnvironment();

    // Step 3: Validate all variables
    const variablesValid = this.validateAllVariables();

    // Step 4: Generate summary
    this.generateSummary();

    // Step 5: Final result
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;

    if (!hasErrors) {
      this.success('\n✅ Environment validation passed!');
    } else {
      this.error('\n❌ Environment validation failed!');
    }

    if (hasWarnings && !this.silent) {
      this.log(`\n⚠️  ${this.warnings.length} warnings found`);
    }

    if (!this.silent && (hasErrors || hasWarnings)) {
      this.log('\n📋 Recommendations:');
      this.log('  1. Check .env files for placeholder values');
      this.log('  2. Verify integration credentials are current');
      this.log('  3. Ensure production secrets are set in deployment platform');
      this.log('  4. Run validation again after fixes');
    }

    return this.generateReport();
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  args.forEach((arg, i) => {
    switch (arg) {
      case '--environment':
      case '-e':
        options.environment = args[i + 1];
        break;
      case '--ci':
        options.ci = true;
        break;
      case '--silent':
        options.silent = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--json':
        options.json = true;
        options.silent = true;
        break;
      case '--help':
      case '-h':
        console.log(`
MS Elevate Environment Validator

Usage: node scripts/validate-env.js [options]

Options:
  -e, --environment <env>  Target environment (development|staging|production)
  --ci                     CI/CD mode (stricter validation)
  --silent                 Suppress console output
  --strict                 Fail on missing files
  --json                   Output JSON report only
  -h, --help              Show this help message

Examples:
  node scripts/validate-env.js                    # Validate current environment
  node scripts/validate-env.js -e production     # Validate production environment
  node scripts/validate-env.js --ci              # Run in CI mode
  node scripts/validate-env.js --json            # JSON output for scripts
        `);
        process.exit(0);
        break;
    }
  });

  const validator = new EnvironmentValidator(options);
  const report = validator.run();

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  }

  // Exit with error code if validation failed
  process.exit(report.status === 'valid' ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { EnvironmentValidator, ENV_RULES };