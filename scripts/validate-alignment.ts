#!/usr/bin/env ts-node
/**
 * Comprehensive validation script for Prisma-first architecture alignment
 * Ensures that Zod schemas, database triggers, and DTO transformations are all in sync
 */

import fs from 'fs';
import path from 'path';

import { z } from 'zod';

// Import our schemas for validation
import { LearnSchema, ExploreSchema, AmplifySchema, PresentSchema, ShineSchema } from '../packages/types/src/schemas';

interface ValidationIssue {
  category: 'critical' | 'warning' | 'info';
  component: string;
  issue: string;
  recommendation: string;
}

const issues: ValidationIssue[] = [];

/**
 * Validate that Zod schemas use snake_case field names
 */
function validateZodSchemas() {
  console.log('🔍 Validating Zod schema field naming conventions...');
  
  const schemas = {
    'LearnSchema': LearnSchema,
    'ExploreSchema': ExploreSchema,
    'AmplifySchema': AmplifySchema,
    'PresentSchema': PresentSchema,
    'ShineSchema': ShineSchema
  };
  
  Object.entries(schemas).forEach(([name, schema]) => {
    try {
      // Get schema shape to inspect field names
      const shape = schema._def.shape();
      const fieldNames = Object.keys(shape);
      
      // Check for camelCase fields that should be snake_case
      fieldNames.forEach(field => {
        if (/[a-z][A-Z]/.test(field)) {
          issues.push({
            category: 'critical',
            component: `Zod ${name}`,
            issue: `Field '${field}' uses camelCase`,
            recommendation: `Convert to snake_case to match database storage format`
          });
        }
      });
      
      // Specific validations for each schema
      if (name === 'AmplifySchema') {
        if (!fieldNames.includes('peers_trained') || !fieldNames.includes('students_trained')) {
          issues.push({
            category: 'critical',
            component: 'AmplifySchema',
            issue: 'Missing required snake_case fields: peers_trained, students_trained',
            recommendation: 'Update AmplifySchema to use snake_case field names for database storage'
          });
        }
      }
      
      if (name === 'LearnSchema') {
        if (!fieldNames.includes('course_name') || !fieldNames.includes('certificate_url')) {
          issues.push({
            category: 'warning',
            component: 'LearnSchema',
            issue: 'Missing expected snake_case fields',
            recommendation: 'Ensure LearnSchema uses snake_case: course_name, certificate_url, completed_at'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        category: 'critical',
        component: `Zod ${name}`,
        issue: `Failed to parse schema: ${error}`,
        recommendation: 'Fix schema definition errors'
      });
    }
  });
}

/**
 * Validate database trigger alignment
 */
function validateDatabaseTriggers() {
  console.log('🔍 Validating database trigger alignment...');
  
  const migrationPath = path.join(__dirname, '..', 'packages', 'db', 'migrations', '20250904150000_fix_trigger_field_names', 'migration.sql');
  
  if (!fs.existsSync(migrationPath)) {
    issues.push({
      category: 'critical',
      component: 'Database Triggers',
      issue: 'Trigger field name fix migration not found',
      recommendation: 'Create migration to fix trigger field names to use snake_case'
    });
    return;
  }
  
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  
  // Check that trigger uses snake_case field names
  if (!migrationContent.includes('peers_trained') || !migrationContent.includes('students_trained')) {
    issues.push({
      category: 'critical',
      component: 'Database Triggers',
      issue: 'Amplify quota trigger still uses camelCase field names',
      recommendation: 'Update trigger to use peers_trained and students_trained (snake_case)'
    });
  }
  
  // Check that old camelCase is removed
  if (migrationContent.includes('peersTrained') || migrationContent.includes('studentsTrained')) {
    issues.push({
      category: 'warning',
      component: 'Database Triggers',
      issue: 'Migration still contains camelCase field references',
      recommendation: 'Remove all camelCase field references from triggers'
    });
  }
}

/**
 * Validate DTO transformation completeness
 */
function validateDTOTransformations() {
  console.log('🔍 Validating DTO transformation layer...');
  
  const dtoPath = path.join(__dirname, '..', 'packages', 'types', 'src', 'dto-mappers.ts');
  
  if (!fs.existsSync(dtoPath)) {
    issues.push({
      category: 'critical',
      component: 'DTO Layer',
      issue: 'DTO mappers file not found',
      recommendation: 'Create comprehensive DTO transformation layer'
    });
    return;
  }
  
  const dtoContent = fs.readFileSync(dtoPath, 'utf8');
  
  // Check for required transformation functions
  const requiredTransforms = [
    'transformLearnAPIToDB',
    'transformLearnDBToAPI',
    'transformAmplifyAPIToDB', 
    'transformAmplifyDBToAPI',
    'transformExploreAPIToDB',
    'transformExploreDBToAPI',
    'transformPresentAPIToDB',
    'transformPresentDBToAPI',
    'transformShineAPIToDB',
    'transformShineDBToAPI'
  ];
  
  requiredTransforms.forEach(transformName => {
    if (!dtoContent.includes(transformName)) {
      issues.push({
        category: 'critical',
        component: 'DTO Layer',
        issue: `Missing transformation function: ${transformName}`,
        recommendation: 'Implement all required payload transformation functions'
      });
    }
  });
  
  // Check for payload type interfaces
  const requiredInterfaces = [
    'LearnPayloadAPI',
    'LearnPayloadDB',
    'AmplifyPayloadAPI',
    'AmplifyPayloadDB',
    'ExplorePayloadAPI',
    'ExplorePayloadDB',
    'PresentPayloadAPI',
    'PresentPayloadDB',
    'ShinePayloadAPI',
    'ShinePayloadDB'
  ];
  
  requiredInterfaces.forEach(interfaceName => {
    if (!dtoContent.includes(`interface ${interfaceName}`)) {
      issues.push({
        category: 'warning',
        component: 'DTO Layer',
        issue: `Missing payload interface: ${interfaceName}`,
        recommendation: 'Define all payload interfaces for type safety'
      });
    }
  });
}

/**
 * Validate API types export alignment
 */
function validateAPITypes() {
  console.log('🔍 Validating API types exports...');
  
  const apiTypesPath = path.join(__dirname, '..', 'packages', 'types', 'src', 'api-types.ts');
  
  if (!fs.existsSync(apiTypesPath)) {
    issues.push({
      category: 'critical',
      component: 'API Types',
      issue: 'API types file not found',
      recommendation: 'Create clean API types with proper exports'
    });
    return;
  }
  
  const apiTypesContent = fs.readFileSync(apiTypesPath, 'utf8');
  
  // Check that transformation functions are exported
  if (!apiTypesContent.includes('transformPayloadAPIToDB') || !apiTypesContent.includes('transformPayloadDBToAPI')) {
    issues.push({
      category: 'warning',
      component: 'API Types',
      issue: 'Generic transformation functions not exported',
      recommendation: 'Export transformPayloadAPIToDB and transformPayloadDBToAPI for general use'
    });
  }
  
  // Check that payload types are exported
  if (!apiTypesContent.includes('LearnPayloadAPI') || !apiTypesContent.includes('AmplifyPayloadAPI')) {
    issues.push({
      category: 'warning',
      component: 'API Types',
      issue: 'Payload API types not properly exported',
      recommendation: 'Export all payload API types for client consumption'
    });
  }
}

/**
 * Validate ESLint boundary rules
 */
function validateESLintRules() {
  console.log('🔍 Validating ESLint boundary enforcement...');
  
  const eslintPath = path.join(__dirname, '..', '.eslintrc.js');
  
  if (!fs.existsSync(eslintPath)) {
    issues.push({
      category: 'critical',
      component: 'ESLint Rules',
      issue: 'ESLint configuration not found',
      recommendation: 'Create ESLint rules to enforce architectural boundaries'
    });
    return;
  }
  
  const eslintContent = fs.readFileSync(eslintPath, 'utf8');
  
  // Check for Prisma import restrictions
  if (!eslintContent.includes('@prisma/client')) {
    issues.push({
      category: 'warning',
      component: 'ESLint Rules',
      issue: 'No Prisma import restrictions configured',
      recommendation: 'Add rules to prevent direct @prisma/client imports outside packages/db'
    });
  }
  
  // Check for boundary script
  const boundaryScriptPath = path.join(__dirname, 'check-boundaries.js');
  if (!fs.existsSync(boundaryScriptPath)) {
    issues.push({
      category: 'info',
      component: 'Boundary Enforcement',
      issue: 'Boundary checking script not found',
      recommendation: 'Create automated boundary checking script for CI/CD'
    });
  }
}

/**
 * Check for example API route compliance
 */
function validateAPIRouteCompliance() {
  console.log('🔍 Validating API route compliance...');
  
  // Check a sample API route for compliance
  const submissionRoutePath = path.join(__dirname, '..', 'apps', 'web', 'app', 'api', 'submissions', 'route.ts');
  
  if (fs.existsSync(submissionRoutePath)) {
    const routeContent = fs.readFileSync(submissionRoutePath, 'utf8');
    
    // Check for direct Prisma client imports
    if (routeContent.includes("from '@prisma/client'")) {
      issues.push({
        category: 'critical',
        component: 'API Routes',
        issue: 'Direct @prisma/client import detected in API route',
        recommendation: 'Use @elevate/db and DTO transformations instead'
      });
    }
    
    // Check for payload transformation usage
    if (routeContent.includes('.payload') && !routeContent.includes('transform')) {
      issues.push({
        category: 'warning',
        component: 'API Routes',
        issue: 'Direct payload access without transformation detected',
        recommendation: 'Use DTO transformation functions for payload handling'
      });
    }
  }
}

/**
 * Main validation function
 */
function runValidation() {
  console.log('🚀 Running Prisma-first architecture alignment validation...\n');
  
  validateZodSchemas();
  validateDatabaseTriggers();
  validateDTOTransformations();
  validateAPITypes();
  validateESLintRules();
  validateAPIRouteCompliance();
  
  console.log('\n📊 Validation Results:');
  console.log('=' .repeat(50));
  
  const critical = issues.filter(i => i.category === 'critical');
  const warnings = issues.filter(i => i.category === 'warning');
  const info = issues.filter(i => i.category === 'info');
  
  if (critical.length === 0 && warnings.length === 0 && info.length === 0) {
    console.log('✅ All validations passed! Architecture is properly aligned.');
    process.exit(0);
  }
  
  if (critical.length > 0) {
    console.log(`\n🔴 CRITICAL ISSUES (${critical.length}):`);
    critical.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.component}: ${issue.issue}`);
      console.log(`   → ${issue.recommendation}\n`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n🟡 WARNINGS (${warnings.length}):`);
    warnings.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.component}: ${issue.issue}`);
      console.log(`   → ${issue.recommendation}\n`);
    });
  }
  
  if (info.length > 0) {
    console.log(`\n🔵 INFO (${info.length}):`);
    info.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.component}: ${issue.issue}`);
      console.log(`   → ${issue.recommendation}\n`);
    });
  }
  
  console.log(`\nSummary: ${critical.length} critical, ${warnings.length} warnings, ${info.length} info`);
  
  // Exit with error code if critical issues found
  process.exit(critical.length > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  runValidation();
}

export { runValidation, ValidationIssue };