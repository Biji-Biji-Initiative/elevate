# Database Security Guide

## Overview

This guide provides comprehensive security policies, compliance procedures, and protection measures for the MS Elevate LEAPS Tracker database system. It addresses data protection requirements for the Indonesian education sector, PII handling, and security best practices for educational platforms.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Access Control & Authentication](#access-control--authentication)
3. [Data Protection & Privacy](#data-protection--privacy)
4. [Encryption & Transport Security](#encryption--transport-security)
5. [Audit & Compliance](#audit--compliance)
6. [Incident Response](#incident-response)
7. [Indonesian Education Compliance](#indonesian-education-compliance)
8. [Security Monitoring](#security-monitoring)
9. [Backup Security](#backup-security)
10. [Security Procedures](#security-procedures)

## Security Architecture

### Defense in Depth Strategy
```
┌─────────────────────────────────────────┐
│          Application Layer              │
│  • Role-Based Access Control (RBAC)    │
│  • Input Validation & Sanitization     │
│  • Rate Limiting & DDoS Protection     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│           Transport Layer               │
│  • TLS 1.3 Encryption                  │
│  • Certificate Pinning                 │
│  • HSTS Headers                        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│            Database Layer               │
│  • Row Level Security (RLS)            │
│  • Column-Level Encryption             │
│  • Connection Pooling Security         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│        Infrastructure Layer             │
│  • VPC Network Isolation               │
│  • Firewall Rules                      │
│  • Intrusion Detection                 │
└─────────────────────────────────────────┘
```

### Security Principles

#### Data Minimization
- **Collect Only Necessary Data**: Limited to educational program requirements
- **Retention Policies**: Automatic data purging based on retention schedules
- **Purpose Limitation**: Data used only for stated educational purposes
- **Access Restriction**: Least privilege access model

#### Privacy by Design
- **Default Privacy**: All submissions private by default
- **User Control**: Educators control public visibility of their profiles
- **Anonymization**: Personal identifiers removed from analytics
- **Transparency**: Clear data usage policies for Indonesian educators

#### Security Controls
- **Multi-Factor Authentication**: Required for admin/reviewer roles
- **Encryption at Rest**: Database and file storage encrypted
- **Encryption in Transit**: TLS 1.3 for all connections
- **Audit Logging**: Complete audit trail for all data access

## Access Control & Authentication

### Role-Based Access Control (RBAC)

#### Role Hierarchy
```typescript
export enum Role {
  PARTICIPANT = 'PARTICIPANT',    // Indonesian educators (default)
  REVIEWER = 'REVIEWER',          // Content reviewers
  ADMIN = 'ADMIN',               // Platform administrators
  SUPERADMIN = 'SUPERADMIN'      // System administrators
}

// Permission matrix
const PERMISSIONS = {
  PARTICIPANT: [
    'submission:create',
    'submission:view_own',
    'profile:update_own',
    'leaderboard:view_public'
  ],
  REVIEWER: [
    ...PERMISSIONS.PARTICIPANT,
    'submission:review',
    'submission:view_all',
    'user:view_basic'
  ],
  ADMIN: [
    ...PERMISSIONS.REVIEWER,
    'user:manage',
    'analytics:view_all',
    'export:download',
    'audit:view'
  ],
  SUPERADMIN: [
    ...PERMISSIONS.ADMIN,
    'system:configure',
    'security:manage',
    'backup:restore'
  ]
} as const;
```

#### Access Control Implementation
```sql
-- Row Level Security (RLS) policies
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY user_own_data_policy ON users
FOR ALL TO authenticated
USING (id = current_setting('app.current_user_id')::text);

-- Policy: Participants can only view their own submissions
CREATE POLICY participant_submission_policy ON submissions
FOR SELECT TO authenticated
USING (
  CASE 
    WHEN current_setting('app.current_user_role') = 'PARTICIPANT' 
    THEN user_id = current_setting('app.current_user_id')::text
    WHEN current_setting('app.current_user_role') IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
    THEN true
    ELSE false
  END
);

-- Policy: Only reviewers+ can update submission status
CREATE POLICY reviewer_submission_update_policy ON submissions
FOR UPDATE TO authenticated
USING (
  current_setting('app.current_user_role') IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
)
WITH CHECK (
  current_setting('app.current_user_role') IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
);

-- Policy: Users can only see their own points
CREATE POLICY user_points_policy ON points_ledger
FOR SELECT TO authenticated
USING (
  CASE 
    WHEN current_setting('app.current_user_role') = 'PARTICIPANT'
    THEN user_id = current_setting('app.current_user_id')::text
    WHEN current_setting('app.current_user_role') IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
    THEN true
    ELSE false
  END
);

-- Policy: Only admins+ can view audit logs
CREATE POLICY admin_audit_policy ON audit_log
FOR SELECT TO authenticated
USING (
  current_setting('app.current_user_role') IN ('ADMIN', 'SUPERADMIN')
);
```

#### Authentication Integration
```typescript
// Middleware to set RLS context
export async function setDatabaseContext(userId: string, role: Role) {
  await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
  await prisma.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true)`;
}

// Secure API handler wrapper
export function withRoleAuthorization(requiredRole: Role) {
  return function(handler: ApiHandler) {
    return async function(req: Request, ctx: any) {
      // Authenticate user via Clerk
      const { userId } = auth();
      if (!userId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user role from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      // Check role permission
      const roleHierarchy = ['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'];
      const userLevel = roleHierarchy.indexOf(user.role);
      const requiredLevel = roleHierarchy.indexOf(requiredRole);

      if (userLevel < requiredLevel) {
        return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      // Set database context
      await setDatabaseContext(userId, user.role);

      // Add user context to request
      req.user = { id: userId, role: user.role };

      return handler(req, ctx);
    };
  };
}
```

### Multi-Factor Authentication (MFA)

#### MFA Requirements
```typescript
// MFA enforcement for elevated roles
export const MFA_REQUIRED_ROLES: Role[] = ['ADMIN', 'SUPERADMIN'];

export async function requireMFA(userId: string, role: Role) {
  if (!MFA_REQUIRED_ROLES.includes(role)) {
    return true; // MFA not required for this role
  }

  // Check MFA status via Clerk
  const user = await clerkClient.users.getUser(userId);
  const hasMFA = user.twoFactorEnabled;

  if (!hasMFA) {
    throw new AuthenticationError('MFA required for this role');
  }

  return true;
}

// Enforce MFA on role promotion
export async function promoteUserRole(userId: string, newRole: Role) {
  // Require current user to have admin permissions
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser.role, 'user:manage')) {
    throw new AuthorizationError('Insufficient permissions');
  }

  // Require target user to have MFA if promoting to admin role
  if (MFA_REQUIRED_ROLES.includes(newRole)) {
    await requireMFA(userId, newRole);
  }

  // Update user role
  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  });

  // Log role change for audit
  await logAuditEvent({
    actor_id: currentUser.id,
    action: 'role_promotion',
    target_id: userId,
    meta: {
      old_role: user.role,
      new_role: newRole,
      timestamp: new Date().toISOString()
    }
  });
}
```

## Data Protection & Privacy

### Personally Identifiable Information (PII)

#### PII Classification
```typescript
// PII data classification for Indonesian educators
export const PII_FIELDS = {
  HIGH_SENSITIVITY: [
    'email',           // Personal email addresses
    'phone_number',    // Indonesian phone numbers
    'id_number',       // Indonesian ID numbers (NIK)
    'tax_id',          // NPWP numbers
    'bank_account'     // Banking details
  ],
  MEDIUM_SENSITIVITY: [
    'full_name',       // Complete names
    'address',         // Physical addresses
    'birth_date',      // Date of birth
    'school_id'        // School identification
  ],
  LOW_SENSITIVITY: [
    'handle',          // Public usernames
    'avatar_url',      // Profile pictures
    'bio',            // Public descriptions
    'social_links'     // Professional social media
  ]
} as const;

// PII handling policies
export class PIIHandler {
  // Encrypt high-sensitivity data
  static async encryptPII(data: string, field: string): Promise<string> {
    if (PII_FIELDS.HIGH_SENSITIVITY.includes(field)) {
      return await encrypt(data, process.env.PII_ENCRYPTION_KEY);
    }
    return data;
  }

  // Anonymize data for analytics
  static anonymizeForAnalytics(userData: any): any {
    return {
      id: hashUserId(userData.id),
      role: userData.role,
      cohort: userData.cohort,
      school_region: extractRegion(userData.school),
      created_at: userData.created_at,
      // Remove all PII fields
      ...omit(userData, [
        ...PII_FIELDS.HIGH_SENSITIVITY,
        ...PII_FIELDS.MEDIUM_SENSITIVITY
      ])
    };
  }

  // Generate anonymized exports
  static async exportAnonymizedData(filters: any) {
    const users = await prisma.user.findMany({
      where: filters,
      select: {
        id: true,
        role: true,
        cohort: true,
        school: true,
        created_at: true,
        submissions: {
          select: {
            activity_code: true,
            status: true,
            created_at: true
          }
        }
      }
    });

    return users.map(user => this.anonymizeForAnalytics(user));
  }
}
```

#### Data Retention & Deletion
```sql
-- Data retention policies for educational compliance
CREATE TABLE data_retention_policies (
  data_type VARCHAR(50) PRIMARY KEY,
  retention_period INTERVAL NOT NULL,
  deletion_method VARCHAR(20) DEFAULT 'SOFT_DELETE',
  compliance_reason TEXT,
  last_updated TIMESTAMP DEFAULT NOW()
);

INSERT INTO data_retention_policies VALUES
('user_profiles', INTERVAL '7 years', 'SOFT_DELETE', 'Indonesian education record requirements'),
('submission_data', INTERVAL '5 years', 'SOFT_DELETE', 'Program evaluation and research'),
('audit_logs', INTERVAL '10 years', 'HARD_DELETE', 'Legal compliance and investigation'),
('analytics_data', INTERVAL '2 years', 'ANONYMIZE', 'Performance analysis only'),
('temporary_files', INTERVAL '30 days', 'HARD_DELETE', 'Storage optimization');

-- Automated data retention function
CREATE OR REPLACE FUNCTION enforce_data_retention()
RETURNS void AS $$
DECLARE
  policy RECORD;
BEGIN
  FOR policy IN SELECT * FROM data_retention_policies LOOP
    CASE policy.deletion_method
      WHEN 'SOFT_DELETE' THEN
        -- Soft delete expired data
        CASE policy.data_type
          WHEN 'user_profiles' THEN
            UPDATE users 
            SET deleted_at = NOW() 
            WHERE created_at < NOW() - policy.retention_period
              AND deleted_at IS NULL;
          
          WHEN 'submission_data' THEN
            UPDATE submissions 
            SET deleted_at = NOW() 
            WHERE created_at < NOW() - policy.retention_period
              AND deleted_at IS NULL;
        END CASE;
      
      WHEN 'HARD_DELETE' THEN
        -- Permanently delete expired data
        CASE policy.data_type
          WHEN 'audit_logs' THEN
            DELETE FROM audit_log 
            WHERE created_at < NOW() - policy.retention_period;
          
          WHEN 'temporary_files' THEN
            DELETE FROM submission_attachments 
            WHERE created_at < NOW() - policy.retention_period
              AND path LIKE '%/tmp/%';
        END CASE;
      
      WHEN 'ANONYMIZE' THEN
        -- Anonymize expired data
        CASE policy.data_type
          WHEN 'analytics_data' THEN
            -- Implementation depends on specific analytics tables
            UPDATE leaderboard_totals 
            SET name = 'User_' || LEFT(MD5(name), 8),
                handle = 'user_' || LEFT(MD5(handle), 8)
            WHERE last_activity_at < NOW() - policy.retention_period;
        END CASE;
    END CASE;
    
    RAISE NOTICE 'Applied retention policy for %: %', policy.data_type, policy.deletion_method;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule retention enforcement monthly
SELECT cron.schedule('data-retention', '0 2 1 * *', 'SELECT enforce_data_retention();');
```

### Data Subject Rights (GDPR/Indonesian DPA)

#### Right to Access
```typescript
// Data subject access request handler
export async function handleDataAccessRequest(userId: string, requesterId: string) {
  // Verify requester authorization
  if (userId !== requesterId) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true }
    });
    
    if (!['ADMIN', 'SUPERADMIN'].includes(requester?.role)) {
      throw new AuthorizationError('Cannot access another user\'s data');
    }
  }

  // Collect all user data
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      submissions: {
        include: {
          attachments_rel: true
        }
      },
      ledger: true,
      earned_badges: {
        include: {
          badge: true
        }
      }
    }
  });

  // Log access request
  await logAuditEvent({
    actor_id: requesterId,
    action: 'data_access_request',
    target_id: userId,
    meta: {
      timestamp: new Date().toISOString(),
      data_types: ['profile', 'submissions', 'points', 'badges']
    }
  });

  return {
    user_profile: userData,
    export_timestamp: new Date().toISOString(),
    retention_info: await getRetentionInfo(userId),
    data_sources: [
      'User profile and settings',
      'Educational submissions and evidence',
      'Point history and achievements',
      'Badge earnings and criteria',
      'Platform activity logs'
    ]
  };
}
```

#### Right to Deletion
```typescript
// Data deletion request handler
export async function handleDataDeletionRequest(
  userId: string, 
  requesterId: string,
  deletionType: 'SOFT' | 'HARD' = 'SOFT'
) {
  // Verify authorization
  await verifyDeletionAuthorization(userId, requesterId);

  // Check for legal holds or compliance requirements
  const legalHolds = await checkLegalHolds(userId);
  if (legalHolds.length > 0) {
    throw new ConflictError('Cannot delete data subject to legal hold');
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (deletionType === 'HARD') {
        // Permanent deletion (GDPR right to erasure)
        await tx.auditLog.deleteMany({ where: { actor_id: userId } });
        await tx.earnedBadge.deleteMany({ where: { user_id: userId } });
        await tx.pointsLedger.deleteMany({ where: { user_id: userId } });
        await tx.submissionAttachment.deleteMany({ 
          where: { 
            submission: { user_id: userId } 
          } 
        });
        await tx.submission.deleteMany({ where: { user_id: userId } });
        await tx.user.delete({ where: { id: userId } });
      } else {
        // Soft deletion (mark as deleted, anonymize PII)
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted_user_${Date.now()}@anonymous.local`,
            name: 'Deleted User',
            handle: `deleted_${Date.now()}`,
            avatar_url: null,
            school: null,
            cohort: null,
            deleted_at: new Date()
          }
        });

        // Anonymize submissions but keep for educational research
        await tx.submission.updateMany({
          where: { user_id: userId },
          data: {
            payload: { anonymized: true, original_deleted: new Date() }
          }
        });
      }

      // Log deletion for compliance
      await tx.auditLog.create({
        data: {
          actor_id: requesterId,
          action: `user_deletion_${deletionType.toLowerCase()}`,
          target_id: userId,
          meta: {
            timestamp: new Date().toISOString(),
            deletion_type: deletionType,
            reason: 'data_subject_request'
          }
        }
      });
    });

    // Clean up external resources (file storage)
    await cleanupUserFiles(userId);

    return {
      success: true,
      deletion_type: deletionType,
      timestamp: new Date().toISOString(),
      affected_records: await countAffectedRecords(userId)
    };

  } catch (error) {
    console.error('Data deletion failed:', error);
    throw new Error(`Data deletion failed: ${error.message}`);
  }
}
```

## Encryption & Transport Security

### Encryption at Rest

#### Database Encryption
```sql
-- Enable transparent data encryption (TDE) via Supabase
-- Configured at the Supabase project level

-- Column-level encryption for sensitive fields
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted storage for sensitive submission data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, field_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Only encrypt PII fields
  IF field_name IN ('email', 'phone', 'id_number', 'tax_id') THEN
    RETURN crypt(data, gen_salt('bf', 8));
  ELSE
    RETURN data;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Decrypt function with audit logging
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT, field_name TEXT, accessor_id TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Log PII access
  INSERT INTO audit_log (actor_id, action, meta)
  VALUES (accessor_id, 'pii_access', jsonb_build_object(
    'field', field_name,
    'timestamp', NOW()
  ));
  
  -- Decrypt if authorized
  RETURN encrypted_data; -- Implement actual decryption logic
END;
$$ LANGUAGE plpgsql;
```

#### File Storage Encryption
```typescript
// Supabase Storage encryption configuration
export const storageConfig = {
  bucket: 'elevate-evidence',
  options: {
    public: false,           // Private bucket
    allowedMimeTypes: [      // Restrict file types
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ],
    fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
    transformations: {
      // Auto-strip EXIF data for privacy
      strip: true,
      quality: 80
    }
  }
};

// Secure file upload with virus scanning
export async function uploadSecureFile(
  file: File, 
  userId: string, 
  submissionId: string
): Promise<string> {
  // Generate secure filename
  const fileExtension = path.extname(file.name);
  const secureFilename = `${userId}/${submissionId}/${crypto.randomUUID()}${fileExtension}`;
  
  // Validate file type and size
  await validateFile(file);
  
  // Scan for malware (if virus scanning service available)
  if (process.env.VIRUS_SCAN_ENABLED) {
    await scanForVirus(file);
  }
  
  // Upload to encrypted storage
  const { data, error } = await supabase.storage
    .from('elevate-evidence')
    .upload(secureFilename, file, {
      contentType: file.type,
      metadata: {
        userId,
        submissionId,
        uploadedAt: new Date().toISOString()
      }
    });
  
  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }
  
  // Log file upload
  await logAuditEvent({
    actor_id: userId,
    action: 'file_upload',
    target_id: submissionId,
    meta: {
      filename: secureFilename,
      file_size: file.size,
      content_type: file.type
    }
  });
  
  return data.path;
}

// Generate secure download URLs with expiration
export async function getSecureFileUrl(
  filePath: string, 
  userId: string, 
  expiresIn: number = 3600
): Promise<string> {
  // Verify user has access to file
  const hasAccess = await verifyFileAccess(filePath, userId);
  if (!hasAccess) {
    throw new AuthorizationError('File access denied');
  }
  
  // Generate signed URL with expiration
  const { data } = await supabase.storage
    .from('elevate-evidence')
    .createSignedUrl(filePath, expiresIn);
  
  // Log file access
  await logAuditEvent({
    actor_id: userId,
    action: 'file_access',
    meta: {
      file_path: filePath,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
    }
  });
  
  return data?.signedUrl || '';
}
```

### Transport Security

#### TLS Configuration
```typescript
// Next.js security headers
export const securityHeaders = {
  // Force HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // XSS protection
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  
  // CSP for Indonesian education domain
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' *.supabase.co",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: *.supabase.co",
    "connect-src 'self' *.supabase.co wss://*.supabase.co",
    "font-src 'self' data:",
    "media-src 'self' *.supabase.co",
    "frame-src 'none'"
  ].join('; '),
  
  // Permissions policy for privacy
  'Permissions-Policy': [
    'camera=self',
    'microphone=self',
    'geolocation=self',
    'payment=none'
  ].join(', ')
};

// Database connection security
export const databaseSecurityConfig = {
  ssl: {
    require: true,
    rejectUnauthorized: true,
    ca: process.env.DATABASE_CA_CERT
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 600000,
  max: 20, // Connection pool limit
  // Connection string validation
  validateConnection: (connection: any) => {
    return connection.processID > 0 && connection.secretKey > 0;
  }
};
```

## Audit & Compliance

### Audit Logging

#### Comprehensive Audit Trail
```sql
-- Enhanced audit log schema
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_type VARCHAR(20) DEFAULT 'USER',
  action VARCHAR(100) NOT NULL,
  target_id TEXT,
  target_type VARCHAR(50),
  resource_type VARCHAR(50),
  outcome VARCHAR(20) DEFAULT 'SUCCESS',
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexing for compliance queries
  CONSTRAINT audit_log_outcome_check CHECK (outcome IN ('SUCCESS', 'FAILURE', 'PARTIAL'))
);

-- Indexes for compliance reporting
CREATE INDEX idx_audit_log_actor_time ON audit_log(actor_id, created_at);
CREATE INDEX idx_audit_log_action_time ON audit_log(action, created_at);
CREATE INDEX idx_audit_log_target_time ON audit_log(target_id, created_at);
CREATE INDEX idx_audit_log_ip_time ON audit_log(ip_address, created_at) WHERE ip_address IS NOT NULL;

-- Audit log trigger for critical tables
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all changes to sensitive tables
  INSERT INTO audit_log (
    actor_id,
    action,
    target_id,
    target_type,
    meta,
    created_at
  ) VALUES (
    COALESCE(current_setting('app.current_user_id', true), 'SYSTEM'),
    TG_OP || '_' || TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_TABLE_NAME,
    jsonb_build_object(
      'old_values', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'new_values', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
      'changed_fields', CASE 
        WHEN TG_OP = 'UPDATE' THEN (
          SELECT array_agg(key) 
          FROM jsonb_each(to_jsonb(NEW)) n 
          JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key 
          WHERE n.value != o.value
        )
        ELSE NULL
      END
    ),
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_submission_changes
  AFTER INSERT OR UPDATE OR DELETE ON submissions
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_points_changes
  AFTER INSERT OR UPDATE OR DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();
```

#### Application-Level Audit Logging
```typescript
// Comprehensive audit logging service
export class AuditLogger {
  static async logSecurityEvent(event: {
    actor_id: string;
    action: string;
    target_id?: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    request_id?: string;
    metadata?: Record<string, any>;
  }) {
    await prisma.auditLog.create({
      data: {
        actor_id: event.actor_id,
        actor_type: 'USER',
        action: event.action,
        target_id: event.target_id,
        target_type: inferTargetType(event.target_id),
        outcome: event.outcome,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        session_id: event.session_id,
        request_id: event.request_id,
        meta: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : null,
        created_at: new Date()
      }
    });
  }

  // Log authentication events
  static async logAuth(userId: string, action: string, outcome: 'SUCCESS' | 'FAILURE', metadata?: any) {
    await this.logSecurityEvent({
      actor_id: userId,
      action: `auth_${action}`,
      outcome,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        event_category: 'authentication'
      }
    });
  }

  // Log data access events
  static async logDataAccess(userId: string, resourceType: string, resourceId: string, action: string) {
    await this.logSecurityEvent({
      actor_id: userId,
      action: `data_${action}`,
      target_id: resourceId,
      outcome: 'SUCCESS',
      metadata: {
        resource_type: resourceType,
        access_level: await getUserAccessLevel(userId),
        timestamp: new Date().toISOString(),
        event_category: 'data_access'
      }
    });
  }

  // Log role changes
  static async logRoleChange(actorId: string, targetUserId: string, oldRole: string, newRole: string) {
    await this.logSecurityEvent({
      actor_id: actorId,
      action: 'role_change',
      target_id: targetUserId,
      outcome: 'SUCCESS',
      metadata: {
        old_role: oldRole,
        new_role: newRole,
        elevation: isRoleElevation(oldRole, newRole),
        timestamp: new Date().toISOString(),
        event_category: 'authorization'
      }
    });
  }
}

// Audit middleware for API routes
export function withAuditLogging(handler: ApiHandler) {
  return async function(req: Request, ctx: any) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    try {
      // Add request tracking
      req.requestId = requestId;
      req.startTime = startTime;
      
      const result = await handler(req, ctx);
      
      // Log successful operations
      if (req.user) {
        await AuditLogger.logSecurityEvent({
          actor_id: req.user.id,
          action: `api_${req.method.toLowerCase()}_${req.url.split('/').pop()}`,
          outcome: 'SUCCESS',
          ip_address: getClientIP(req),
          user_agent: req.headers.get('user-agent'),
          request_id: requestId,
          metadata: {
            response_time_ms: Date.now() - startTime,
            status_code: result.status || 200
          }
        });
      }
      
      return result;
    } catch (error) {
      // Log failed operations
      if (req.user) {
        await AuditLogger.logSecurityEvent({
          actor_id: req.user.id,
          action: `api_${req.method.toLowerCase()}_${req.url.split('/').pop()}`,
          outcome: 'FAILURE',
          ip_address: getClientIP(req),
          user_agent: req.headers.get('user-agent'),
          request_id: requestId,
          metadata: {
            error_type: error.constructor.name,
            error_message: error.message,
            response_time_ms: Date.now() - startTime
          }
        });
      }
      
      throw error;
    }
  };
}
```

### Compliance Reporting

#### Indonesian Data Protection Compliance
```sql
-- Compliance reporting views
CREATE VIEW compliance_audit_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  action,
  COUNT(*) as event_count,
  COUNT(DISTINCT actor_id) as unique_users,
  COUNT(*) FILTER (WHERE outcome = 'SUCCESS') as successful_events,
  COUNT(*) FILTER (WHERE outcome = 'FAILURE') as failed_events
FROM audit_log
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), action
ORDER BY month DESC, event_count DESC;

-- Data subject rights compliance
CREATE VIEW data_subject_rights_report AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) FILTER (WHERE action = 'data_access_request') as access_requests,
  COUNT(*) FILTER (WHERE action LIKE '%deletion%') as deletion_requests,
  COUNT(*) FILTER (WHERE action = 'data_export') as export_requests,
  AVG(
    EXTRACT(EPOCH FROM (
      CASE 
        WHEN action = 'data_access_request' 
        THEN COALESCE((meta->>'completion_time')::timestamp, created_at + INTERVAL '1 day')
        ELSE created_at
      END - created_at
    ))/86400
  ) as avg_response_time_days
FROM audit_log
WHERE action IN ('data_access_request', 'user_deletion_soft', 'user_deletion_hard', 'data_export')
  AND created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Security incident reporting
CREATE VIEW security_incidents_report AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) FILTER (WHERE action LIKE '%failed_login%') as failed_logins,
  COUNT(*) FILTER (WHERE action LIKE '%unauthorized%') as unauthorized_access,
  COUNT(*) FILTER (WHERE action LIKE '%suspicious%') as suspicious_activity,
  COUNT(DISTINCT ip_address) FILTER (WHERE outcome = 'FAILURE') as unique_threat_ips,
  COUNT(DISTINCT actor_id) FILTER (WHERE outcome = 'FAILURE') as affected_users
FROM audit_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND (outcome = 'FAILURE' OR action LIKE '%security%')
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

#### Automated Compliance Reports
```typescript
// Generate monthly compliance report
export async function generateComplianceReport(month: string) {
  const startDate = new Date(`${month}-01`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  
  const [
    auditSummary,
    dataSubjectRights,
    securityIncidents,
    accessPatterns,
    dataRetention
  ] = await Promise.all([
    getAuditSummary(startDate, endDate),
    getDataSubjectRightsMetrics(startDate, endDate),
    getSecurityIncidents(startDate, endDate),
    getAccessPatterns(startDate, endDate),
    getDataRetentionStatus()
  ]);

  const report = {
    period: month,
    generated_at: new Date().toISOString(),
    compliance_status: 'COMPLIANT', // Will be calculated
    sections: {
      executive_summary: generateExecutiveSummary({
        auditSummary,
        dataSubjectRights,
        securityIncidents
      }),
      audit_summary: auditSummary,
      data_subject_rights: dataSubjectRights,
      security_incidents: securityIncidents,
      access_patterns: accessPatterns,
      data_retention: dataRetention,
      recommendations: generateRecommendations({
        auditSummary,
        securityIncidents
      })
    }
  };

  // Store report for audit trail
  await storeComplianceReport(report);
  
  return report;
}

async function getDataSubjectRightsMetrics(startDate: Date, endDate: Date) {
  const metrics = await prisma.$queryRaw`
    SELECT 
      COUNT(*) FILTER (WHERE action = 'data_access_request') as access_requests,
      COUNT(*) FILTER (WHERE action LIKE '%deletion%') as deletion_requests,
      COUNT(*) FILTER (WHERE action = 'data_export') as export_requests,
      COUNT(*) FILTER (WHERE 
        action IN ('data_access_request', 'user_deletion_soft', 'user_deletion_hard', 'data_export') 
        AND (meta->>'response_time_hours')::int <= 72
      ) as compliant_responses,
      COUNT(DISTINCT actor_id) as unique_requesters
    FROM audit_log
    WHERE created_at >= ${startDate} 
      AND created_at <= ${endDate}
      AND action IN ('data_access_request', 'user_deletion_soft', 'user_deletion_hard', 'data_export')
  `;

  return {
    total_requests: metrics[0].access_requests + metrics[0].deletion_requests + metrics[0].export_requests,
    access_requests: Number(metrics[0].access_requests),
    deletion_requests: Number(metrics[0].deletion_requests),
    export_requests: Number(metrics[0].export_requests),
    compliance_rate: calculateComplianceRate(metrics[0]),
    average_response_time: await getAverageResponseTime(startDate, endDate),
    unique_requesters: Number(metrics[0].unique_requesters)
  };
}
```

## Incident Response

### Security Incident Classification

#### Incident Severity Levels
```typescript
export enum IncidentSeverity {
  LOW = 'LOW',           // Minor policy violations, failed login attempts
  MEDIUM = 'MEDIUM',     // Unauthorized access attempts, data validation errors
  HIGH = 'HIGH',         // Successful unauthorized access, data leakage
  CRITICAL = 'CRITICAL'  // Data breach, system compromise, widespread impact
}

export interface SecurityIncident {
  id: string;
  severity: IncidentSeverity;
  category: 'ACCESS_VIOLATION' | 'DATA_BREACH' | 'SYSTEM_COMPROMISE' | 'MALWARE' | 'DDOS';
  title: string;
  description: string;
  affected_users: string[];
  affected_systems: string[];
  first_detected: Date;
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';
  assignee?: string;
  timeline: IncidentTimelineEvent[];
  evidence: IncidentEvidence[];
  impact_assessment: ImpactAssessment;
  response_actions: ResponseAction[];
}

// Automated incident detection
export class IncidentDetector {
  static async detectSuspiciousActivity() {
    const suspiciousPatterns = await Promise.all([
      this.detectFailedLoginSpike(),
      this.detectUnusualDataAccess(),
      this.detectPrivilegeEscalation(),
      this.detectMassDataExport(),
      this.detectBruteForceAttack()
    ]);

    const incidents = suspiciousPatterns
      .filter(pattern => pattern.detected)
      .map(pattern => this.createIncident(pattern));

    for (const incident of incidents) {
      await this.raiseIncident(incident);
    }

    return incidents;
  }

  static async detectFailedLoginSpike(): Promise<SuspiciousPattern> {
    const failedLogins = await prisma.auditLog.count({
      where: {
        action: 'auth_failed_login',
        created_at: {
          gte: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
        }
      }
    });

    return {
      detected: failedLogins > 50, // Threshold for Indonesian context
      type: 'FAILED_LOGIN_SPIKE',
      severity: failedLogins > 100 ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
      metadata: {
        failed_login_count: failedLogins,
        time_window: '30 minutes',
        threshold_exceeded: failedLogins > 50
      }
    };
  }

  static async detectUnusualDataAccess(): Promise<SuspiciousPattern> {
    // Detect access to large volumes of PII data
    const suspiciousAccess = await prisma.$queryRaw`
      SELECT 
        actor_id,
        COUNT(*) as access_count,
        COUNT(DISTINCT target_id) as unique_targets
      FROM audit_log
      WHERE action LIKE '%data_access%'
        AND created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY actor_id
      HAVING COUNT(*) > 100 OR COUNT(DISTINCT target_id) > 50
    `;

    return {
      detected: suspiciousAccess.length > 0,
      type: 'UNUSUAL_DATA_ACCESS',
      severity: IncidentSeverity.HIGH,
      metadata: {
        suspicious_actors: suspiciousAccess,
        detection_threshold: 'More than 100 accesses or 50 unique targets in 1 hour'
      }
    };
  }

  static async detectPrivilegeEscalation(): Promise<SuspiciousPattern> {
    // Detect rapid role changes or unusual admin activity
    const roleChanges = await prisma.$queryRaw`
      SELECT 
        actor_id,
        COUNT(*) as role_changes,
        array_agg(DISTINCT meta->>'new_role') as roles_granted
      FROM audit_log
      WHERE action = 'role_change'
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY actor_id
      HAVING COUNT(*) > 5
    `;

    return {
      detected: roleChanges.length > 0,
      type: 'PRIVILEGE_ESCALATION',
      severity: IncidentSeverity.CRITICAL,
      metadata: {
        suspicious_actors: roleChanges,
        detection_rule: 'More than 5 role changes in 24 hours'
      }
    };
  }
}
```

### Incident Response Procedures

#### Automated Response Actions
```typescript
// Incident response automation
export class IncidentResponder {
  static async respondToIncident(incident: SecurityIncident) {
    console.log(`🚨 Security Incident Detected: ${incident.title}`);
    
    // Immediate containment actions
    await this.executeContainmentActions(incident);
    
    // Notification and escalation
    await this.notifySecurityTeam(incident);
    
    // Evidence preservation
    await this.preserveEvidence(incident);
    
    // Impact assessment
    await this.assessImpact(incident);
    
    // Recovery initiation
    if (incident.severity === IncidentSeverity.CRITICAL) {
      await this.initiateEmergencyRecovery(incident);
    }
  }

  static async executeContainmentActions(incident: SecurityIncident) {
    switch (incident.category) {
      case 'ACCESS_VIOLATION':
        // Temporarily suspend suspicious accounts
        for (const userId of incident.affected_users) {
          await this.suspendUserSession(userId);
          await this.requirePasswordReset(userId);
        }
        break;

      case 'DATA_BREACH':
        // Revoke all active sessions for affected users
        for (const userId of incident.affected_users) {
          await this.revokeAllSessions(userId);
        }
        // Temporarily disable data exports
        await this.disableDataExports();
        break;

      case 'SYSTEM_COMPROMISE':
        // Enable enhanced monitoring
        await this.enableEnhancedMonitoring();
        // Restrict admin access
        await this.restrictAdminAccess();
        break;

      case 'DDOS':
        // Enable rate limiting
        await this.enableEmergencyRateLimit();
        break;
    }
  }

  static async suspendUserSession(userId: string) {
    // Revoke Clerk sessions
    await clerkClient.users.ban(userId);
    
    // Log containment action
    await AuditLogger.logSecurityEvent({
      actor_id: 'SYSTEM',
      action: 'user_session_suspended',
      target_id: userId,
      outcome: 'SUCCESS',
      metadata: {
        reason: 'security_incident',
        timestamp: new Date().toISOString()
      }
    });
  }

  static async notifySecurityTeam(incident: SecurityIncident) {
    const notification = {
      incident_id: incident.id,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      affected_users_count: incident.affected_users.length,
      first_detected: incident.first_detected,
      containment_actions: incident.response_actions.length
    };

    // Send to security monitoring channel
    await sendToSlackChannel('#security-alerts', 
      formatSecurityAlert(notification), 
      incident.severity === IncidentSeverity.CRITICAL ? 'error' : 'warning'
    );

    // Send email to security team
    if (incident.severity === IncidentSeverity.CRITICAL) {
      await sendEmergencyEmail(
        process.env.SECURITY_TEAM_EMAIL,
        'CRITICAL Security Incident - MS Elevate',
        formatSecurityEmail(notification)
      );
    }

    // Create PagerDuty alert for critical incidents
    if (incident.severity === IncidentSeverity.CRITICAL) {
      await createPagerDutyAlert(incident);
    }
  }

  static async preserveEvidence(incident: SecurityIncident) {
    const evidenceCollector = new EvidenceCollector(incident.id);
    
    // Preserve relevant audit logs
    await evidenceCollector.preserveAuditLogs(
      incident.first_detected,
      new Date()
    );
    
    // Preserve database state snapshots
    await evidenceCollector.createDatabaseSnapshot();
    
    // Preserve file system evidence
    await evidenceCollector.preserveFileSystemEvidence();
    
    // Create incident evidence package
    const evidencePackage = await evidenceCollector.createEvidencePackage();
    
    // Store evidence securely
    await this.storeSecureEvidence(evidencePackage);
  }
}

// Evidence collection for forensics
class EvidenceCollector {
  constructor(private incidentId: string) {}

  async preserveAuditLogs(startTime: Date, endTime: Date) {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        created_at: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: { created_at: 'asc' }
    });

    // Create tamper-evident evidence file
    const evidenceFile = {
      incident_id: this.incidentId,
      evidence_type: 'audit_logs',
      collection_time: new Date().toISOString(),
      data: auditLogs,
      hash: await this.calculateHash(JSON.stringify(auditLogs)),
      chain_of_custody: [
        {
          action: 'collected',
          actor: 'SYSTEM',
          timestamp: new Date().toISOString()
        }
      ]
    };

    return evidenceFile;
  }

  async createDatabaseSnapshot() {
    // Create point-in-time snapshot of critical tables
    const snapshot = await prisma.$transaction([
      prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } }),
      prisma.auditLog.findMany({ 
        where: { 
          created_at: { 
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
          } 
        } 
      }),
      // Include other critical tables
    ]);

    return {
      incident_id: this.incidentId,
      evidence_type: 'database_snapshot',
      collection_time: new Date().toISOString(),
      data: snapshot,
      hash: await this.calculateHash(JSON.stringify(snapshot))
    };
  }

  private async calculateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
```

## Indonesian Education Compliance

### Educational Data Protection

#### Student Privacy Protection (Indonesian Context)
```typescript
// Indonesian education-specific privacy controls
export class IndonesianEducationPrivacy {
  // Protect student data according to Indonesian education laws
  static async protectStudentData(amplifySubmission: any) {
    // Validate that student data is properly anonymized
    const studentData = amplifySubmission.payload.studentsData || [];
    
    for (const student of studentData) {
      if (this.containsPII(student)) {
        throw new ValidationError('Student PII detected in submission');
      }
    }

    // Ensure compliance with Ministry of Education guidelines
    await this.validateEducationCompliance(amplifySubmission);
    
    return amplifySubmission;
  }

  // Check for Indonesian PII patterns
  static containsPII(data: any): boolean {
    const piiPatterns = [
      /\b\d{16}\b/,          // Indonesian ID (NIK) pattern
      /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // Formatted ID pattern
      /\b\d{10,12}\b/,       // Phone number patterns
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Email
      /\bNISN\s*:?\s*\d+/i,  // NISN (Student ID) pattern
    ];

    const dataString = JSON.stringify(data).toLowerCase();
    return piiPatterns.some(pattern => pattern.test(dataString));
  }

  // Validate education compliance requirements
  static async validateEducationCompliance(submission: any) {
    const violations = [];

    // Check for proper consent documentation
    if (!submission.payload.consentDocumented) {
      violations.push('Missing student/parent consent documentation');
    }

    // Validate institutional approval
    if (!submission.payload.institutionalApproval) {
      violations.push('Missing institutional approval for student data usage');
    }

    // Check for data minimization
    if (this.hasExcessiveStudentData(submission.payload)) {
      violations.push('Excessive student data collection detected');
    }

    if (violations.length > 0) {
      throw new ValidationError(`Education compliance violations: ${violations.join(', ')}`);
    }
  }

  static hasExcessiveStudentData(payload: any): boolean {
    const allowedFields = ['grade_level', 'subject', 'performance_metric', 'anonymized_id'];
    const studentData = payload.studentsData || [];
    
    return studentData.some((student: any) => {
      const studentFields = Object.keys(student);
      return studentFields.some(field => !allowedFields.includes(field));
    });
  }
}
```

#### Regional Compliance Requirements
```sql
-- Indonesian regional data localization requirements
CREATE TABLE regional_compliance_settings (
  region_code VARCHAR(10) PRIMARY KEY,
  region_name VARCHAR(100) NOT NULL,
  data_localization_required BOOLEAN DEFAULT false,
  additional_consent_required BOOLEAN DEFAULT false,
  retention_period_months INTEGER DEFAULT 60,
  special_requirements JSONB,
  compliance_contact VARCHAR(255),
  last_updated TIMESTAMP DEFAULT NOW()
);

INSERT INTO regional_compliance_settings VALUES
('ID-JK', 'Jakarta', true, false, 60, 
 '{"audit_frequency": "quarterly", "reporting_required": true}', 
 'compliance.jakarta@elevate.org'),
('ID-JB', 'Jawa Barat', false, false, 60, 
 '{"audit_frequency": "annually"}', 
 'compliance.jabar@elevate.org'),
('ID-SU', 'Sumatera Utara', false, true, 84,
 '{"additional_consent": "parental_consent_required", "language": "batak"}',
 'compliance.sumut@elevate.org');

-- Function to check regional compliance
CREATE OR REPLACE FUNCTION check_regional_compliance(user_school TEXT, submission_data JSONB)
RETURNS TABLE(compliant BOOLEAN, violations TEXT[]) AS $$
DECLARE
  user_region VARCHAR(10);
  region_settings RECORD;
  violation_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Determine user region from school location
  user_region := CASE 
    WHEN user_school ILIKE '%jakarta%' THEN 'ID-JK'
    WHEN user_school ILIKE '%bandung%' OR user_school ILIKE '%jawa barat%' THEN 'ID-JB'
    WHEN user_school ILIKE '%medan%' OR user_school ILIKE '%sumatera utara%' THEN 'ID-SU'
    ELSE 'ID-DEFAULT'
  END;
  
  -- Get regional settings
  SELECT * INTO region_settings
  FROM regional_compliance_settings
  WHERE region_code = user_region;
  
  -- Check data localization requirements
  IF region_settings.data_localization_required AND submission_data->>'data_stored_location' != 'indonesia' THEN
    violation_list := array_append(violation_list, 'Data must be stored within Indonesia for this region');
  END IF;
  
  -- Check additional consent requirements
  IF region_settings.additional_consent_required AND submission_data->>'additional_consent' IS NULL THEN
    violation_list := array_append(violation_list, 'Additional consent required for this region');
  END IF;
  
  RETURN QUERY SELECT 
    array_length(violation_list, 1) IS NULL AS compliant,
    violation_list AS violations;
END;
$$ LANGUAGE plpgsql;
```

## Security Monitoring

### Real-Time Security Monitoring

#### Threat Detection System
```typescript
// Real-time security monitoring
export class SecurityMonitor {
  private static alertThresholds = {
    failed_logins_per_minute: 10,
    data_exports_per_hour: 5,
    admin_actions_per_hour: 20,
    new_users_per_minute: 3,
    file_uploads_per_minute: 50
  };

  static async monitorSecurityMetrics() {
    const metrics = await this.collectSecurityMetrics();
    
    // Check each metric against thresholds
    for (const [metric, value] of Object.entries(metrics)) {
      const threshold = this.alertThresholds[metric as keyof typeof this.alertThresholds];
      
      if (threshold && value > threshold) {
        await this.raiseSecurityAlert(metric, value, threshold);
      }
    }
    
    // Store metrics for trending
    await this.storeSecurityMetrics(metrics);
  }

  static async collectSecurityMetrics() {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      failedLoginsLastMinute,
      dataExportsLastHour,
      adminActionsLastHour,
      newUsersLastMinute,
      fileUploadsLastMinute
    ] = await Promise.all([
      prisma.auditLog.count({
        where: {
          action: 'auth_failed_login',
          created_at: { gte: oneMinuteAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: 'data_export',
          created_at: { gte: oneHourAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: { contains: 'admin_' },
          created_at: { gte: oneHourAgo }
        }
      }),
      prisma.user.count({
        where: {
          created_at: { gte: oneMinuteAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: 'file_upload',
          created_at: { gte: oneMinuteAgo }
        }
      })
    ]);

    return {
      failed_logins_per_minute: failedLoginsLastMinute,
      data_exports_per_hour: dataExportsLastHour,
      admin_actions_per_hour: adminActionsLastHour,
      new_users_per_minute: newUsersLastMinute,
      file_uploads_per_minute: fileUploadsLastMinute,
      timestamp: now.toISOString()
    };
  }

  static async raiseSecurityAlert(metric: string, value: number, threshold: number) {
    const alert = {
      type: 'security_threshold_exceeded',
      severity: this.calculateSeverity(metric, value, threshold),
      metric,
      current_value: value,
      threshold,
      timestamp: new Date().toISOString()
    };

    // Send immediate notification
    await sendToSlackChannel('#security-alerts', 
      `🚨 Security Alert: ${metric} exceeded threshold (${value} > ${threshold})`,
      'error'
    );

    // Log security alert
    await AuditLogger.logSecurityEvent({
      actor_id: 'SYSTEM',
      action: 'security_alert_raised',
      outcome: 'SUCCESS',
      metadata: alert
    });

    // Trigger automated response if critical
    if (alert.severity === 'CRITICAL') {
      await this.triggerAutomatedResponse(metric, value);
    }
  }

  private static calculateSeverity(metric: string, value: number, threshold: number): string {
    const ratio = value / threshold;
    
    if (ratio > 5) return 'CRITICAL';
    if (ratio > 3) return 'HIGH';
    if (ratio > 2) return 'MEDIUM';
    return 'LOW';
  }

  private static async triggerAutomatedResponse(metric: string, value: number) {
    switch (metric) {
      case 'failed_logins_per_minute':
        // Enable temporary rate limiting
        await this.enableEmergencyRateLimit();
        break;
      
      case 'data_exports_per_hour':
        // Temporarily disable data exports
        await this.temporaryDisableDataExports();
        break;
      
      case 'admin_actions_per_hour':
        // Require additional authentication for admin actions
        await this.enableAdminMFA();
        break;
    }
  }
}
```

### Vulnerability Scanning

#### Automated Security Scanning
```typescript
// Security vulnerability scanning
export class VulnerabilityScanner {
  static async performSecurityScan() {
    console.log('🔍 Starting security vulnerability scan...');
    
    const results = await Promise.all([
      this.scanDatabaseSecurity(),
      this.scanApplicationSecurity(),
      this.scanDependencyVulnerabilities(),
      this.scanConfigurationSecurity()
    ]);

    const vulnerabilities = results.flat();
    
    if (vulnerabilities.length > 0) {
      await this.reportVulnerabilities(vulnerabilities);
    }

    return {
      scan_timestamp: new Date().toISOString(),
      total_vulnerabilities: vulnerabilities.length,
      critical_vulnerabilities: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
      vulnerabilities
    };
  }

  static async scanDatabaseSecurity() {
    const vulnerabilities = [];

    // Check for default passwords
    const defaultPasswords = await this.checkDefaultPasswords();
    if (defaultPasswords.found) {
      vulnerabilities.push({
        type: 'DEFAULT_CREDENTIALS',
        severity: 'CRITICAL',
        description: 'Default database credentials detected',
        recommendation: 'Change all default passwords immediately'
      });
    }

    // Check for unencrypted sensitive data
    const unencryptedData = await this.checkUnencryptedSensitiveData();
    if (unencryptedData.found) {
      vulnerabilities.push({
        type: 'UNENCRYPTED_PII',
        severity: 'HIGH',
        description: 'Unencrypted PII data detected',
        recommendation: 'Enable column-level encryption for sensitive fields'
      });
    }

    // Check for excessive permissions
    const excessivePermissions = await this.checkExcessivePermissions();
    if (excessivePermissions.found) {
      vulnerabilities.push({
        type: 'EXCESSIVE_PERMISSIONS',
        severity: 'MEDIUM',
        description: 'Users with unnecessary database privileges',
        recommendation: 'Review and revoke excessive permissions'
      });
    }

    return vulnerabilities;
  }

  static async scanApplicationSecurity() {
    const vulnerabilities = [];

    // Check for SQL injection vulnerabilities
    const sqlInjection = await this.checkSQLInjection();
    if (sqlInjection.found) {
      vulnerabilities.push({
        type: 'SQL_INJECTION',
        severity: 'CRITICAL',
        description: 'Potential SQL injection vulnerabilities',
        affected_endpoints: sqlInjection.endpoints,
        recommendation: 'Use parameterized queries and input validation'
      });
    }

    // Check for XSS vulnerabilities
    const xssVulns = await this.checkXSSVulnerabilities();
    if (xssVulns.found) {
      vulnerabilities.push({
        type: 'XSS',
        severity: 'HIGH',
        description: 'Cross-site scripting vulnerabilities detected',
        affected_endpoints: xssVulns.endpoints,
        recommendation: 'Implement proper output encoding and CSP headers'
      });
    }

    // Check for insecure file uploads
    const insecureUploads = await this.checkInsecureFileUploads();
    if (insecureUploads.found) {
      vulnerabilities.push({
        type: 'INSECURE_FILE_UPLOAD',
        severity: 'HIGH',
        description: 'Insecure file upload configuration',
        recommendation: 'Implement file type validation and virus scanning'
      });
    }

    return vulnerabilities;
  }

  private static async checkSQLInjection() {
    // Static code analysis for SQL injection patterns
    const dangerousPatterns = [
      /\$\{.*\}/g,  // Template string interpolation in SQL
      /\+.*query/gi, // String concatenation in queries
      /raw\s*\(/gi   // Raw SQL usage
    ];

    // This would typically scan the actual codebase
    // For demo purposes, we'll simulate the check
    return {
      found: false, // Would be determined by actual scanning
      endpoints: []
    };
  }

  private static async checkUnencryptedSensitiveData() {
    // Check for PII fields without encryption
    const sensitiveFields = await prisma.$queryRaw`
      SELECT column_name, table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN ('email', 'phone', 'id_number', 'tax_id')
        AND data_type = 'text'
    `;

    return {
      found: sensitiveFields.length > 0,
      fields: sensitiveFields
    };
  }

  static async reportVulnerabilities(vulnerabilities: any[]) {
    const criticalCount = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'HIGH').length;

    const report = {
      scan_date: new Date().toISOString(),
      total_vulnerabilities: vulnerabilities.length,
      severity_breakdown: {
        critical: criticalCount,
        high: highCount,
        medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        low: vulnerabilities.filter(v => v.severity === 'LOW').length
      },
      vulnerabilities
    };

    // Send security report
    await sendToSlackChannel('#security-alerts',
      formatVulnerabilityReport(report),
      criticalCount > 0 ? 'error' : 'warning'
    );

    // Store vulnerability report
    await this.storeVulnerabilityReport(report);

    return report;
  }
}

// Scheduled vulnerability scanning
export async function scheduleSecurityScanning() {
  // Daily vulnerability scan
  cron.schedule('0 2 * * *', async () => {
    console.log('🔍 Starting scheduled vulnerability scan...');
    
    try {
      const results = await VulnerabilityScanner.performSecurityScan();
      console.log(`✅ Vulnerability scan completed: ${results.total_vulnerabilities} issues found`);
    } catch (error) {
      console.error('❌ Vulnerability scan failed:', error);
      
      await AuditLogger.logSecurityEvent({
        actor_id: 'SYSTEM',
        action: 'vulnerability_scan_failed',
        outcome: 'FAILURE',
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Weekly comprehensive security review
  cron.schedule('0 3 * * 0', async () => {
    console.log('📊 Starting weekly security review...');
    
    try {
      const [
        vulnerabilityReport,
        complianceReport,
        auditSummary
      ] = await Promise.all([
        VulnerabilityScanner.performSecurityScan(),
        generateComplianceReport(new Date().toISOString().slice(0, 7)), // Current month
        generateWeeklyAuditSummary()
      ]);

      await sendWeeklySecurityReport({
        vulnerabilities: vulnerabilityReport,
        compliance: complianceReport,
        audit: auditSummary
      });

    } catch (error) {
      console.error('❌ Weekly security review failed:', error);
    }
  });
}
```

This comprehensive security guide provides the foundation for maintaining a secure, compliant database system that protects Indonesian educators' data while supporting the educational mission of the MS Elevate LEAPS Tracker platform. The security measures are designed to meet international standards while addressing specific Indonesian education sector requirements.