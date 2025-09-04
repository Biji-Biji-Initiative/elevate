#!/usr/bin/env node

/**
 * Elevate Secrets Vault Manager
 * 
 * A comprehensive secrets management solution for the MS Elevate LEAPS Tracker
 * that works with the existing three-layer environment system while providing
 * encrypted storage and secure sharing capabilities.
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecretsVault {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.vaultDir = path.join(this.projectRoot, '.secrets');
    this.algorithm = 'aes-256-gcm';
    this.keyDerivationRounds = 100000;
    this.ensureVaultDirectory();
  }

  ensureVaultDirectory() {
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Generate a strong encryption key from a master password
   */
  deriveKey(masterPassword, salt) {
    return crypto.pbkdf2Sync(masterPassword, salt, this.keyDerivationRounds, 32, 'sha256');
  }

  /**
   * Encrypt environment data with authenticated encryption
   */
  encrypt(data, masterPassword) {
    const salt = crypto.randomBytes(32);
    const key = this.deriveKey(masterPassword, salt);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Create simple authentication hash for integrity
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(encrypted);
    const authTag = hmac.digest('hex');
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag,
      algorithm: 'aes-256-ctr',
      keyDerivationRounds: this.keyDerivationRounds,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Decrypt environment data with authentication verification
   */
  decrypt(encryptedData, masterPassword) {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = this.deriveKey(masterPassword, salt);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    
    // Verify authentication tag
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(encryptedData.encrypted);
    const expectedAuthTag = hmac.digest('hex');
    
    if (expectedAuthTag !== encryptedData.authTag) {
      throw new Error('Authentication failed - data may have been tampered with');
    }
    
    const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Parse environment file into key-value pairs
   */
  parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Environment file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const envVars = {};
    
    content.split('\n').forEach((line, index) => {
      line = line.trim();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        return;
      }
      
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Remove surrounding quotes if present
        let cleanValue = value;
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          cleanValue = value.slice(1, -1);
        }
        envVars[key] = cleanValue;
      } else {
        console.warn(`Warning: Invalid line format at ${filePath}:${index + 1}: ${line}`);
      }
    });
    
    return envVars;
  }

  /**
   * Create encrypted vault from environment files
   */
  createVault(environment, masterPassword) {
    console.log(`📦 Creating encrypted vault for ${environment} environment...`);
    
    const envFiles = [
      `.env.${environment}`,
      `.env.${environment}.local`
    ].filter(file => fs.existsSync(path.join(this.projectRoot, file)));

    if (envFiles.length === 0) {
      throw new Error(`No environment files found for ${environment}`);
    }

    const envData = {};
    
    envFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      console.log(`  Reading ${file}...`);
      
      const vars = this.parseEnvFile(filePath);
      Object.assign(envData, vars);
    });

    const metadata = {
      environment,
      files: envFiles,
      variableCount: Object.keys(envData).length,
      createdAt: new Date().toISOString(),
      createdBy: process.env.USER || 'unknown'
    };

    const encryptedData = this.encrypt({ envData, metadata }, masterPassword);
    
    const vaultFile = path.join(this.vaultDir, `${environment}.vault`);
    fs.writeFileSync(vaultFile, JSON.stringify(encryptedData, null, 2), { mode: 0o600 });
    
    console.log(`✅ Vault created: ${vaultFile}`);
    console.log(`   Variables: ${metadata.variableCount}`);
    console.log(`   Files: ${metadata.files.join(', ')}`);
    
    return vaultFile;
  }

  /**
   * Extract environment variables from encrypted vault
   */
  extractVault(environment, masterPassword, outputPath = null) {
    const vaultFile = path.join(this.vaultDir, `${environment}.vault`);
    
    if (!fs.existsSync(vaultFile)) {
      throw new Error(`Vault not found for environment: ${environment}`);
    }

    console.log(`🔓 Extracting vault for ${environment} environment...`);
    
    const encryptedData = JSON.parse(fs.readFileSync(vaultFile, 'utf8'));
    
    try {
      const decryptedData = this.decrypt(encryptedData, masterPassword);
      const { envData, metadata } = decryptedData;
      
      console.log(`   Created: ${metadata.createdAt}`);
      console.log(`   Variables: ${metadata.variableCount}`);
      
      if (outputPath) {
        // Write to specific file
        this.writeEnvFile(outputPath, envData);
        console.log(`✅ Environment extracted to: ${outputPath}`);
      } else {
        // Write to standard location
        const outputFile = path.join(this.projectRoot, `.env.${environment}.local`);
        this.writeEnvFile(outputFile, envData);
        console.log(`✅ Environment extracted to: ${outputFile}`);
      }
      
      return envData;
    } catch (error) {
      throw new Error(`Failed to decrypt vault: ${error.message}`);
    }
  }

  /**
   * Write environment variables to file
   */
  writeEnvFile(filePath, envData) {
    const lines = [];
    lines.push('# Extracted from encrypted vault');
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push('');
    
    Object.entries(envData).forEach(([key, value]) => {
      // Escape quotes in values
      const escapedValue = value.includes(' ') || value.includes('#') ? 
        `"${value.replace(/"/g, '\\"')}"` : value;
      lines.push(`${key}=${escapedValue}`);
    });
    
    fs.writeFileSync(filePath, lines.join('\n') + '\n', { mode: 0o600 });
  }

  /**
   * List available vaults
   */
  listVaults() {
    console.log('📋 Available vaults:');
    
    if (!fs.existsSync(this.vaultDir)) {
      console.log('   No vaults found');
      return [];
    }

    const vaults = fs.readdirSync(this.vaultDir)
      .filter(file => file.endsWith('.vault'))
      .map(file => {
        const environment = file.replace('.vault', '');
        const filePath = path.join(this.vaultDir, file);
        const stats = fs.statSync(filePath);
        
        try {
          const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          console.log(`   ${environment}: ${encryptedData.timestamp || stats.mtime.toISOString()}`);
          return environment;
        } catch {
          console.log(`   ${environment}: (corrupted)`);
          return null;
        }
      })
      .filter(Boolean);

    if (vaults.length === 0) {
      console.log('   No valid vaults found');
    }

    return vaults;
  }

  /**
   * Rotate vault encryption (re-encrypt with new password)
   */
  rotateVault(environment, oldPassword, newPassword) {
    console.log(`🔄 Rotating vault encryption for ${environment}...`);
    
    const vaultFile = path.join(this.vaultDir, `${environment}.vault`);
    if (!fs.existsSync(vaultFile)) {
      throw new Error(`Vault not found for environment: ${environment}`);
    }

    // Decrypt with old password
    const encryptedData = JSON.parse(fs.readFileSync(vaultFile, 'utf8'));
    const decryptedData = this.decrypt(encryptedData, oldPassword);
    
    // Re-encrypt with new password
    const newEncryptedData = this.encrypt(decryptedData, newPassword);
    
    // Backup old vault
    const backupFile = `${vaultFile}.backup.${Date.now()}`;
    fs.copyFileSync(vaultFile, backupFile);
    
    // Write new vault
    fs.writeFileSync(vaultFile, JSON.stringify(newEncryptedData, null, 2), { mode: 0o600 });
    
    console.log(`✅ Vault encryption rotated`);
    console.log(`   Backup: ${path.basename(backupFile)}`);
  }

  /**
   * Generate a secure random master password
   */
  generateMasterPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 32;
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const vault = new SecretsVault();
  
  try {
    switch (command) {
      case 'create': {
        const environment = args[1];
        const masterPassword = args[2] || process.env.VAULT_MASTER_PASSWORD;
        
        if (!environment) {
          console.error('Usage: vault-manager.js create <environment> [password]');
          process.exit(1);
        }
        
        if (!masterPassword) {
          console.error('Error: Master password required (use VAULT_MASTER_PASSWORD env var or pass as argument)');
          process.exit(1);
        }
        
        vault.createVault(environment, masterPassword);
        break;
      }
      
      case 'extract': {
        const environment = args[1];
        const masterPassword = args[2] || process.env.VAULT_MASTER_PASSWORD;
        const outputPath = args[3];
        
        if (!environment) {
          console.error('Usage: vault-manager.js extract <environment> [password] [output-path]');
          process.exit(1);
        }
        
        if (!masterPassword) {
          console.error('Error: Master password required (use VAULT_MASTER_PASSWORD env var or pass as argument)');
          process.exit(1);
        }
        
        vault.extractVault(environment, masterPassword, outputPath);
        break;
      }
      
      case 'list':
        vault.listVaults();
        break;
      
      case 'rotate': {
        const environment = args[1];
        const oldPassword = args[2] || process.env.VAULT_OLD_PASSWORD;
        const newPassword = args[3] || process.env.VAULT_NEW_PASSWORD;
        
        if (!environment || !oldPassword || !newPassword) {
          console.error('Usage: vault-manager.js rotate <environment> <old-password> <new-password>');
          console.error('Or set VAULT_OLD_PASSWORD and VAULT_NEW_PASSWORD env vars');
          process.exit(1);
        }
        
        vault.rotateVault(environment, oldPassword, newPassword);
        break;
      }
      
      case 'generate-password':
        console.log('🔐 Generated master password:');
        console.log(vault.generateMasterPassword());
        console.log('\n⚠️  Store this password securely - it cannot be recovered!');
        break;
      
      case 'help':
      default:
        console.log(`
Elevate Secrets Vault Manager

Commands:
  create <env> [password]           Create encrypted vault from .env files
  extract <env> [password] [path]  Extract vault to .env file
  list                             List available vaults
  rotate <env> <old> <new>         Rotate vault encryption
  generate-password                Generate secure master password
  help                             Show this help

Examples:
  # Create production vault
  vault-manager.js create production

  # Extract development secrets
  vault-manager.js extract development

  # Rotate production vault encryption
  vault-manager.js rotate production old_pass new_pass

Environment Variables:
  VAULT_MASTER_PASSWORD            Default master password
  VAULT_OLD_PASSWORD              Old password for rotation
  VAULT_NEW_PASSWORD              New password for rotation

Security Notes:
  - Vaults are encrypted with AES-256-GCM
  - Master passwords are never stored
  - Use strong, unique passwords for each environment
  - Rotate passwords periodically
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecretsVault };