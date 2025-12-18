const fs = require('fs');
const { execSync } = require('child_process');

module.exports = {
  // Client JavaScript/JSX files (root directory, excluding server)
  '*.{js,jsx}': (filenames) => {
    const clientFiles = filenames.filter(f => !f.startsWith('server/'));
    
    if (clientFiles.length === 0) {
      return [];
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
    
    // Convert full paths to relative paths from server directory
    const serverFiles = filenames.map(f => f.replace(/^server\//, ''));
    
    return [
      // ESLint fix
      (filenames) => {
        try {
          const files = filenames.map(f => f.replace(/^server\//, '')).join(' ');
          execSync(`cd server && npm run lint:fix -- ${files}`, { stdio: 'inherit' });
          return true;
        } catch (error) {
          return false;
        }
      },
      // Prettier format
      (filenames) => {
        try {
          const files = filenames.map(f => f.replace(/^server\//, '')).join(' ');
          execSync(`cd server && npm run format:fix -- ${files}`, { stdio: 'inherit' });
          return true;
        } catch (error) {
          return false;
        }
      }
    ];
  },
  
  // JSON and Markdown files
  '*.{json,md}': ['prettier --write'],
  
  // Package files - validate JSON syntax
  'package*.json': [
    'prettier --write',
    (filenames) => {
      const errors = [];
      filenames.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          JSON.parse(content);
        } catch (error) {
          errors.push(`Invalid JSON in ${file}: ${error.message}`);
        }
      });
      if (errors.length > 0) {
        console.error('\n❌ JSON validation errors:');
        errors.forEach(err => console.error(`  ${err}`));
        process.exit(1);
      }
      return true;
    }
  ],
  
  // Check for large files (warning only, non-blocking)
  '*': (filenames) => {
    const largeFiles = [];
    const maxSize = 1024 * 1024; // 1MB
    
    filenames.forEach(file => {
      try {
        // Skip if file doesn't exist (might be deleted)
        if (!fs.existsSync(file)) return;
        
        const stats = fs.statSync(file);
        if (stats.isFile() && stats.size > maxSize) {
          largeFiles.push({ file, size: (stats.size / 1024 / 1024).toFixed(2) });
        }
      } catch (error) {
        // Ignore errors (file might not exist, permissions, etc.)
      }
    });
    
    if (largeFiles.length > 0) {
      console.warn('\n⚠️  Large files detected (>1MB):');
      largeFiles.forEach(({ file, size }) => {
        console.warn(`  ${file} (${size} MB)`);
      });
      console.warn('Consider using Git LFS for large files.\n');
    }
    
    return true; // Non-blocking, always return true
  }
};
