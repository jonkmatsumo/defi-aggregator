const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper function to detect secrets in file content
function detectSecrets(file) {
  const secrets = [];
  try {
    if (!fs.existsSync(file)) return secrets;
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    // Patterns to detect potential secrets
    const patterns = [
      {
        name: 'API Key',
        regex: /(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i,
      },
      {
        name: 'Private Key',
        regex: /-----BEGIN\s+.*PRIVATE\s+KEY-----/i,
      },
      {
        name: 'Password',
        regex: /(password|pwd|passwd)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/i,
      },
      {
        name: 'Token',
        regex: /(token|access_token|bearer)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/i,
      },
      {
        name: 'AWS Key',
        regex: /(aws[_-]?access[_-]?key[_-]?id|aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9+/=]{20,})['"]?/i,
      },
    ];
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        if (pattern.regex.test(line) && !line.includes('example') && !line.includes('placeholder')) {
          secrets.push({
            type: pattern.name,
            file,
            line: index + 1,
            preview: line.trim().substring(0, 80),
          });
        }
      });
    });
  } catch (error) {
    // Ignore errors (file might not be text, permissions, etc.)
  }
  
  return secrets;
}

// Helper function to check for merge conflict markers
function detectMergeConflicts(file) {
  try {
    if (!fs.existsSync(file)) return false;
    
    const content = fs.readFileSync(file, 'utf8');
    // Check for conflict markers
    return /^<<<<<<< |^======= |^>>>>>>> /.test(content);
  } catch (error) {
    return false;
  }
}

module.exports = {
  // Client JavaScript/JSX files (root directory, excluding server)
  '*.{js,jsx}': (filenames) => {
    const clientFiles = filenames.filter(f => !f.startsWith('server/'));
    
    if (clientFiles.length === 0) {
      return [];
    }
    
    // Check for merge conflicts
    const conflictFiles = clientFiles.filter(detectMergeConflicts);
    if (conflictFiles.length > 0) {
      console.error('\n❌ Merge conflict markers detected in:');
      conflictFiles.forEach(file => console.error(`  ${file}`));
      console.error('Please resolve all merge conflicts before committing.\n');
      process.exit(1);
    }
    
    return [
      `eslint --fix ${clientFiles.join(' ')}`,
      `prettier --write ${clientFiles.join(' ')}`
    ];
  },
  
  // Server JavaScript files - handle separately
  'server/**/*.js': (filenames) => {
    if (filenames.length === 0) {
      return [];
    }
    
    // Check for merge conflicts
    const conflictFiles = filenames.filter(detectMergeConflicts);
    if (conflictFiles.length > 0) {
      console.error('\n❌ Merge conflict markers detected in:');
      conflictFiles.forEach(file => console.error(`  ${file}`));
      console.error('Please resolve all merge conflicts before committing.\n');
      process.exit(1);
    }
    
    // Convert to relative paths from server directory
    const serverRelativeFiles = filenames.map(f => {
      const absPath = path.resolve(f);
      const serverPath = path.resolve('server');
      return path.relative(serverPath, absPath);
    });
    
    // Return commands that will be executed from root directory
    return [
      // ESLint fix - run from server directory
      `cd server && npx eslint --fix ${serverRelativeFiles.join(' ')}`,
      // Prettier format - run from server directory
      `cd server && npx prettier --write ${serverRelativeFiles.join(' ')}`
    ];
  },
  
  // JSON and Markdown files
  '*.{json,md}': (filenames) => {
    // Check for merge conflicts
    const conflictFiles = filenames.filter(detectMergeConflicts);
    if (conflictFiles.length > 0) {
      console.error('\n❌ Merge conflict markers detected in:');
      conflictFiles.forEach(file => console.error(`  ${file}`));
      console.error('Please resolve all merge conflicts before committing.\n');
      process.exit(1);
    }
    
    return ['prettier --write'];
  },
  
  // Package files - validate JSON syntax
  'package*.json': (filenames) => {
    const errors = [];
    
    filenames.forEach(file => {
      // Check for merge conflicts
      if (detectMergeConflicts(file)) {
        errors.push(`Merge conflict markers found in ${file}`);
        return;
      }
      
      try {
        const content = fs.readFileSync(file, 'utf8');
        JSON.parse(content);
      } catch (error) {
        errors.push(`Invalid JSON in ${file}: ${error.message}`);
      }
    });
    
    if (errors.length > 0) {
      console.error('\n❌ Validation errors:');
      errors.forEach(err => console.error(`  ${err}`));
      process.exit(1);
    }
    
    return ['prettier --write'];
  },
  
  // Check for large files, binary files, and secrets (warning only, non-blocking)
  '*': (filenames) => {
    const largeFiles = [];
    const binaryFiles = [];
    const foundSecrets = [];
    const maxSize = 1024 * 1024; // 1MB
    
    // Common binary file extensions
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
      '.exe', '.dll', '.so', '.dylib', '.bin',
      '.mp4', '.mp3', '.wav', '.avi', '.mov',
      '.db', '.sqlite', '.sqlite3',
    ];
    
    // Text file extensions (where we check for secrets)
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.yml', '.yaml',
      '.env', '.env.example', '.sh', '.bash', '.zsh', '.py', '.java', '.go',
      '.rb', '.php', '.cpp', '.c', '.h', '.hpp', '.cs', '.rs', '.swift',
    ];
    
    filenames.forEach(file => {
      try {
        // Skip if file doesn't exist (might be deleted)
        if (!fs.existsSync(file)) return;
        
        const stats = fs.statSync(file);
        if (!stats.isFile()) return;
        
        // Check for large files
        if (stats.size > maxSize) {
          largeFiles.push({ file, size: (stats.size / 1024 / 1024).toFixed(2) });
        }
        
        // Check for binary files by extension
        const ext = path.extname(file).toLowerCase();
        if (binaryExtensions.includes(ext)) {
          binaryFiles.push(file);
        }
        
        // Check for secrets in text files (but skip node_modules and build directories)
        if (
          textExtensions.includes(ext) &&
          !file.includes('node_modules') &&
          !file.includes('build/') &&
          !file.includes('dist/') &&
          !file.includes('coverage/')
        ) {
          const secrets = detectSecrets(file);
          if (secrets.length > 0) {
            foundSecrets.push(...secrets.map(s => ({ ...s, file })));
          }
        }
      } catch (error) {
        // Ignore errors (file might not exist, permissions, etc.)
      }
    });
    
    // Display warnings (non-blocking)
    if (largeFiles.length > 0) {
      console.warn('\n⚠️  Large files detected (>1MB):');
      largeFiles.forEach(({ file, size }) => {
        console.warn(`  ${file} (${size} MB)`);
      });
      console.warn('Consider using Git LFS for large files.\n');
    }
    
    if (binaryFiles.length > 0) {
      console.warn('⚠️  Binary files detected:');
      binaryFiles.forEach(file => {
        console.warn(`  ${file}`);
      });
      console.warn('Ensure these files are necessary and not accidentally committed.\n');
    }
    
    if (foundSecrets.length > 0) {
      console.warn('⚠️  Potential secrets detected (please verify these are not real secrets):');
      foundSecrets.forEach(({ type, file, line, preview }) => {
        console.warn(`  ${file}:${line} - ${type}`);
        console.warn(`    ${preview}`);
      });
      console.warn('If these are real secrets, remove them immediately and rotate any exposed credentials.\n');
    }
    
    return true; // Non-blocking, always return true
  }
};
