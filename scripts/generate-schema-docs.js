#!/usr/bin/env node

/**
 * Generate database schema documentation from Prisma schema
 * Creates comprehensive documentation in Markdown format
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SCHEMA_PATH = 'packages/db/schema.prisma';
const OUTPUT_PATH = 'docs/DATABASE.md';
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read and parse Prisma schema
function parseSchema() {
  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const lines = schemaContent.split('\n');
  
  const schema = {
    models: [],
    enums: [],
    generator: null,
    datasource: null
  };
  
  let currentBlock = null;
  let currentBlockType = null;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('//')) continue;
    
    // Detect block starts
    if (line.startsWith('model ')) {
      currentBlockType = 'model';
      currentBlock = {
        name: line.split(' ')[1],
        fields: [],
        indexes: [],
        relations: [],
        comments: []
      };
      braceCount = 0;
    } else if (line.startsWith('enum ')) {
      currentBlockType = 'enum';
      currentBlock = {
        name: line.split(' ')[1],
        values: []
      };
      braceCount = 0;
    } else if (line.startsWith('generator ')) {
      currentBlockType = 'generator';
      currentBlock = {
        name: line.split(' ')[1],
        properties: []
      };
    } else if (line.startsWith('datasource ')) {
      currentBlockType = 'datasource';
      currentBlock = {
        name: line.split(' ')[1],
        properties: []
      };
    }
    
    // Count braces to determine block end
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;
    
    // Parse content within blocks
    if (currentBlock && braceCount > 0) {
      if (currentBlockType === 'model') {
        parseModelField(line, currentBlock);
      } else if (currentBlockType === 'enum') {
        parseEnumValue(line, currentBlock);
      } else if (currentBlockType === 'generator' || currentBlockType === 'datasource') {
        parseProperty(line, currentBlock);
      }
    }
    
    // Block end
    if (currentBlock && braceCount === 0 && line.includes('}')) {
      if (currentBlockType === 'model') {
        schema.models.push(currentBlock);
      } else if (currentBlockType === 'enum') {
        schema.enums.push(currentBlock);
      } else if (currentBlockType === 'generator') {
        schema.generator = currentBlock;
      } else if (currentBlockType === 'datasource') {
        schema.datasource = currentBlock;
      }
      currentBlock = null;
      currentBlockType = null;
    }
  }
  
  return schema;
}

function parseModelField(line, model) {
  // Skip lines that are not field definitions
  if (line.startsWith('model ') || line === '{' || line === '}' || line.startsWith('@@')) {
    if (line.startsWith('@@')) {
      model.indexes.push(line);
    }
    return;
  }
  
  // Parse field definition
  const fieldMatch = line.match(/^(\w+)\s+(\w+(?:\[\])?(?:\?)?)\s*(.*)?$/);
  if (fieldMatch) {
    const [, name, type, attributes] = fieldMatch;
    model.fields.push({
      name,
      type,
      attributes: attributes || '',
      isArray: type.includes('[]'),
      isOptional: type.includes('?'),
      isPrimaryKey: attributes && attributes.includes('@id'),
      isUnique: attributes && attributes.includes('@unique'),
      hasDefault: attributes && attributes.includes('@default'),
      isRelation: attributes && (attributes.includes('references:') || attributes.includes('@relation'))
    });
  }
}

function parseEnumValue(line, enumBlock) {
  if (!line.startsWith('enum ') && line !== '{' && line !== '}') {
    enumBlock.values.push(line.trim());
  }
}

function parseProperty(line, block) {
  if (!line.includes('=') || line.startsWith('generator ') || line.startsWith('datasource ')) return;
  
  const [key, value] = line.split('=').map(s => s.trim());
  block.properties.push({ key, value });
}

// Generate markdown documentation
function generateDocumentation(schema) {
  let markdown = `# Database Schema Documentation

> Generated on ${new Date().toISOString()}
> Source: \`${SCHEMA_PATH}\`

## Overview

This document describes the database schema for the MS Elevate LEAPS Tracker application. The schema is defined using Prisma ORM and serves as the single source of truth for database structure.

## Configuration

### Datasource
- **Provider**: ${schema.datasource?.properties.find(p => p.key === 'provider')?.value || 'postgresql'}
- **URL**: Environment variable \`DATABASE_URL\`

### Generator
- **Provider**: ${schema.generator?.properties.find(p => p.key === 'provider')?.value || 'prisma-client-js'}

## Enums

`;

  // Document enums
  schema.enums.forEach(enumDef => {
    markdown += `### ${enumDef.name}\n\n`;
    markdown += `| Value | Description |\n`;
    markdown += `|-------|-------------|\n`;
    
    enumDef.values.forEach(value => {
      const description = getEnumValueDescription(enumDef.name, value);
      markdown += `| \`${value}\` | ${description} |\n`;
    });
    
    markdown += '\n';
  });

  markdown += `## Models

`;

  // Document models
  schema.models.forEach(model => {
    markdown += `### ${model.name}\n\n`;
    markdown += getModelDescription(model.name) + '\n\n';
    
    // Fields table
    markdown += `#### Fields\n\n`;
    markdown += `| Field | Type | Attributes | Description |\n`;
    markdown += `|-------|------|------------|-------------|\n`;
    
    model.fields.forEach(field => {
      const typeDisplay = field.type + (field.isArray ? '[]' : '') + (field.isOptional ? '?' : '');
      const attributes = [];
      
      if (field.isPrimaryKey) attributes.push('🔑 Primary Key');
      if (field.isUnique) attributes.push('🔐 Unique');
      if (field.hasDefault) attributes.push('⚙️ Default');
      if (field.isRelation) attributes.push('🔗 Relation');
      
      const description = getFieldDescription(model.name, field.name);
      
      markdown += `| \`${field.name}\` | \`${typeDisplay}\` | ${attributes.join(', ')} | ${description} |\n`;
    });
    
    // Indexes
    if (model.indexes.length > 0) {
      markdown += `\n#### Indexes\n\n`;
      model.indexes.forEach(index => {
        markdown += `- \`${index}\`\n`;
      });
    }
    
    // Relations
    const relations = model.fields.filter(f => f.isRelation);
    if (relations.length > 0) {
      markdown += `\n#### Relations\n\n`;
      relations.forEach(rel => {
        const relDescription = getRelationDescription(model.name, rel.name);
        markdown += `- **${rel.name}**: ${relDescription}\n`;
      });
    }
    
    markdown += '\n';
  });

  // Add additional sections
  markdown += generateSecuritySection();
  markdown += generateViewsSection();
  markdown += generateFunctionsSection();
  markdown += generateMigrationSection();

  return markdown;
}

// Helper functions for descriptions
function getModelDescription(modelName) {
  const descriptions = {
    'User': 'Represents application users synced from Clerk authentication service.',
    'Activity': 'Defines the 5 LEAPS framework activities (Learn, Explore, Amplify, Present, Shine).',
    'Submission': 'Evidence submissions for LEAPS activities with review workflow.',
    'PointsLedger': 'Append-only ledger tracking all point changes for audit trail.',
    'Badge': 'Achievement badges that users can earn based on criteria.',
    'EarnedBadge': 'Junction table tracking which badges users have earned.',
    'KajabiEvent': 'Webhook events from Kajabi for automatic Learn activity credit.',
    'AuditLog': 'System audit trail for administrative actions and changes.'
  };
  
  return descriptions[modelName] || `The ${modelName} model.`;
}

function getFieldDescription(modelName, fieldName) {
  const descriptions = {
    'User.id': 'Unique identifier, mirrors Clerk user ID',
    'User.handle': 'Unique username/handle for public profile URLs',
    'User.kajabi_contact_id': 'Kajabi contact ID for webhook matching',
    'Submission.payload': 'Activity-specific submission data (JSON)',
    'Submission.attachments': 'Array of file storage paths',
    'Submission.visibility': 'Controls public/private visibility on profiles',
    'PointsLedger.external_event_id': 'Unique ID for idempotent webhook processing',
    'PointsLedger.delta_points': 'Point change (positive or negative)',
    'Activity.default_points': 'Standard points awarded for this activity'
  };
  
  const key = `${modelName}.${fieldName}`;
  return descriptions[key] || '';
}

function getEnumValueDescription(enumName, value) {
  const descriptions = {
    'Role.PARTICIPANT': 'Default role for educators',
    'Role.REVIEWER': 'Can review and approve submissions',
    'Role.ADMIN': 'Full administrative access',
    'Role.SUPERADMIN': 'System-level administrative access',
    'SubmissionStatus.PENDING': 'Awaiting review',
    'SubmissionStatus.APPROVED': 'Accepted and points awarded',
    'SubmissionStatus.REJECTED': 'Rejected with review notes',
    'Visibility.PUBLIC': 'Visible on public profiles and leaderboard',
    'Visibility.PRIVATE': 'Only visible to user and reviewers',
    'LedgerSource.MANUAL': 'Manually adjusted by admin',
    'LedgerSource.WEBHOOK': 'Automatic via Kajabi webhook',
    'LedgerSource.FORM': 'Through submission approval process'
  };
  
  const key = `${enumName}.${value}`;
  return descriptions[key] || '';
}

function getRelationDescription(modelName, fieldName) {
  const descriptions = {
    'User.submissions': 'All submissions created by this user',
    'User.ledger': 'All point entries for this user',
    'User.earned_badges': 'Badges earned by this user',
    'Submission.user': 'User who created this submission',
    'Submission.activity': 'LEAPS activity this submission is for',
    'PointsLedger.user': 'User these points belong to',
    'PointsLedger.activity': 'Activity these points were earned for'
  };
  
  const key = `${modelName}.${fieldName}`;
  return descriptions[key] || `Related ${fieldName}`;
}

function generateSecuritySection() {
  return `## Security & Access Control

### Row Level Security (RLS)

All tables have Row Level Security enabled with the following policies:

#### Users Table
- Users can view and update their own profile
- Public profiles are viewable by all authenticated users
- Only admins can create/delete users

#### Submissions Table
- Users can create and view their own submissions
- Users can update their own pending submissions
- Reviewers can view all submissions for review
- Public submissions are viewable by all users

#### Points Ledger
- Users can view their own points history
- Reviewers can view all points for audit purposes
- Points entries are append-only (immutable)

#### Audit Log
- Only admins can view audit logs
- All users can create audit entries for their actions
- Audit logs are append-only for integrity

### Authentication Functions

- \`auth.get_user_role()\`: Extract user role from JWT token
- \`auth.is_admin()\`: Check admin privileges
- \`auth.is_reviewer()\`: Check reviewer privileges
- \`auth.get_user_id()\`: Get current user ID from JWT

`;
}

function generateViewsSection() {
  return `## Views & Materialized Views

### Leaderboard Views

#### \`leaderboard_totals\`
All-time leaderboard with public submissions only.

#### \`leaderboard_30d\`  
30-day rolling leaderboard for recent activity.

#### \`user_points_summary\`
Points breakdown per user by activity type.

### Metrics Views

#### \`public_submission_metrics\`
Aggregated submission statistics without personal data.

All views respect RLS policies and only show appropriate data based on user permissions.

`;
}

function generateFunctionsSection() {
  return `## Functions

### \`get_user_total_points(target_user_id TEXT)\`
Returns total points for a user with permission checking.
- Users can get their own points
- Admins can get any user's points
- Returns NULL for unauthorized access

### \`refresh_leaderboards()\`
Refreshes materialized views for leaderboard data.
- Run after bulk point changes
- Typically called post-deployment

`;
}

function generateMigrationSection() {
  return `## Migration Management

### Schema Source of Truth

Prisma schema (\`${SCHEMA_PATH}\`) serves as the canonical definition. All database changes should:

1. Start with Prisma schema updates
2. Generate migrations using provided scripts
3. Apply and test migrations
4. Update documentation

### Migration Scripts

- \`scripts/db/generate-migrations.sh\`: Create SQL migrations from Prisma
- \`scripts/db/check-drift.sh\`: Detect schema drift
- \`scripts/db/sync-supabase.sh\`: Sync Supabase migrations

### Best Practices

1. Always update Prisma schema first
2. Test migrations locally before deploying
3. Create backups before major schema changes
4. Use append-only patterns for audit data
5. Maintain referential integrity with foreign keys

---

*This documentation is auto-generated from the Prisma schema. Last updated: ${new Date().toISOString()}*
`;
}

// Main execution
try {
  console.log('📖 Parsing Prisma schema...');
  const schema = parseSchema();
  
  console.log(`✅ Found ${schema.models.length} models and ${schema.enums.length} enums`);
  
  console.log('📝 Generating documentation...');
  const documentation = generateDocumentation(schema);
  
  console.log(`💾 Writing to ${OUTPUT_PATH}...`);
  fs.writeFileSync(OUTPUT_PATH, documentation);
  
  console.log('🎉 Schema documentation generated successfully!');
  console.log(`📄 Output: ${OUTPUT_PATH}`);
  console.log(`📊 Size: ${documentation.length} characters`);
  
} catch (error) {
  console.error('❌ Error generating schema documentation:', error.message);
  process.exit(1);
}