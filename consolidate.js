const fs = require('fs');
const path = require('path');
const semver = require('semver');

//Config for Consolidations
class Config {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.resolve(__dirname, '.');
    this.mainPackagePath = path.join(this.rootDir, 'package.json');
    this.configPath = path.join(this.rootDir, 'module_paths.json');
    this.peerDepsToPromote = new Set(
      options.peerDepsToPromote || ['react', 'react-dom', '@mui/material']
    );
    this.entryLocations = options.entryLocations || [
      'src/lib',
      'src/components',
    ];
    this.entryFiles = options.entryFiles || ['index.js', 'index.ts'];
  }
}
// File Utilities
class FileUtils {
  static readJson(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
      throw new Error(`Failed to read ${filePath}: ${error.message}`);
    }
  }
  static writeJson(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    } catch (error) {
      throw new Error(`Failed to write in ${filePath}: ${error.message}`);
    }
  }
  static exists(filePath) {
    return fs.existsSync(filePath);
  }
}
class ConflictCollector {
  constructor() {
    this.conflicts = [];
  }
  addConflict(message) {
    this.conflicts.push(message);
  }
  hasConflicts() {
    return this.conflicts.length > 0;
  }
  getReport() {
    const header =
      '❌ Build aborted. Major version conflicts detected. Please resolve the following issues:';
    return [header, ...this.conflicts.map((c) => `  - ${c}`)].join('\n');
  }
}

class DependencyUtils {
  static validate(allSubmodulePackages, conflictCollector) {
    const allDepsMap = new Map();
    // 1. Collect all versions of each dependency from all submodules
    for (const { name, pkg } of allSubmodulePackages) {
      ['dependencies', 'devDependencies', 'peerDependencies'].forEach(
        (depType) => {
          if (!pkg[depType]) return;
          for (const [depName, depVersion] of Object.entries(pkg[depType])) {
            if (!allDepsMap.has(depName)) {
              // Store an array of objects, each containing the version and its source
              allDepsMap.set(depName, []);
            }
            allDepsMap.get(depName).push({ version: depVersion, source: name });
          }
        }
      );
    }

    // 2. Check for major version conflicts in the collected map
    for (const [depName, versionInfos] of allDepsMap.entries()) {
      if (versionInfos.length > 1) {
        const majorVersions = new Set(
          [...versionInfos].map((info) =>
            semver.major(semver.coerce(info.version))
          )
        );
        if (majorVersions.size > 1) {
          const details = versionInfos
            .map((info) => `"${info.source}"=>"${info.version}"`)
            .join(' ;; ');

          conflictCollector.addConflict(
            `Dependency '${depName}' has a major version conflict: ${details}`
          );
        }
      }
    }
  }

  static merge(target, source) {
    if (!source) return;
    for (const [pkg, version] of Object.entries(source)) {
      if (!target[pkg] || this.isVersionHigher(version, target[pkg])) {
        target[pkg] = version;
      }
    }
  }
  static isVersionHigher(newVersion, currentVersion) {
    try {
      return semver.gt(
        semver.coerce(newVersion),
        semver.coerce(currentVersion)
      );
    } catch (error) {
      console.warn(
        `Version comparision failed for ${newVersion} vs ${currentVersion}`
      );
      return false;
    }
  }
  static sortDependencies(packagJson) {
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach((key) => {
      if (packagJson[key]) {
        packagJson[key] = Object.fromEntries(
          Object.entries(packagJson[key]).sort(([a], [b]) => a.localeCompare(b))
        );
      }
    });
  }
}

class SourceFileFinder {
  constructor(config) {
    this.config = config;
  }
  find(submoduleDir) {
    for (const location of this.config.entryLocations) {
      for (const file of this.config.entryFiles) {
        const fullPath = path.join(submoduleDir, location, file);
        if (FileUtils.exists(fullPath)) {
          return path
            .relative(this.config.rootDir, fullPath)
            .replace(/\\/g, '/');
        }
      }
    }
    console.warn(`Couldnot find entry file for ${submoduleDir}`);
  }
}

class SubmoduleProcessor {
  constructor(config) {
    this.config = config;
    this.sourceFileFinder = new SourceFileFinder(config);
  }

  process(submoduleName, relativePkgPath, consolidatedDeps, packageConfig) {
    const submodulePkgPath = path.join(this.config.rootDir, relativePkgPath);

    if (!FileUtils.exists(submodulePkgPath)) {
      console.warn(`Package.json not found at ${relativePkgPath}`);
      return false;
    }
    const submodulePkg = FileUtils.readJson(submodulePkgPath);
    const submoduleDir = path.dirname(submodulePkgPath);

    this._promoteToPeerDeps(submodulePkg, consolidatedDeps);

    DependencyUtils.merge(
      consolidatedDeps.dependencies,
      submodulePkg.dependencies
    );
    DependencyUtils.merge(
      consolidatedDeps.devDependencies,
      submodulePkg.devDependencies
    );
    DependencyUtils.merge(
      consolidatedDeps.peerDependencies,
      submodulePkg.peerDependencies
    );

    this._addPackageConfig(submoduleName, submoduleDir, packageConfig);
    return true;
  }

  _promoteToPeerDeps(submodulePkg, consolidatedDeps) {
    if (!submodulePkg.dependencies) return;

    for (const pkgName of this.config.peerDepsToPromote) {
      if (submodulePkg.dependencies[pkgName]) {
        // Add to peer dependencies
        const depToPromote = { [pkgName]: submodulePkg.dependencies[pkgName] };
        DependencyUtils.merge(consolidatedDeps.peerDependencies, depToPromote);

        // Remove from regular dependencies
        delete submodulePkg.dependencies[pkgName];
      }
    }
  }

  _addPackageConfig(submoduleName, submoduleDir, packageConfig) {
    // Add export
    packageConfig.exports[`./interfaces/${submoduleName}`] = {
      import: `./dist/components/interfaces/${submoduleName}/index.js`,
      require: `./dist/components/interfaces/${submoduleName}/index.js`,
    };

    // Add target
    const sourceFilePath = this.sourceFileFinder.find(submoduleDir);
    packageConfig.targets[submoduleName] = {
      source: sourceFilePath,
      distDir: `dist/components/interfaces/${submoduleName}`,
      context: 'node',
      isLibrary: true,
    };
  }
}

class PackageConsolidator {
  constructor(config = new Config()) {
    this.config = config;
    this.processor = new SubmoduleProcessor(config);
  }
  async run() {
    console.log('Merging submodule package.json into main packages.json');

    const mainPackageJson = FileUtils.readJson(this.config.mainPackagePath);
    const submoduleConfig = FileUtils.readJson(this.config.configPath);
    const submoduleNames = Object.keys(submoduleConfig);

    //collect all the submodule data
    const allSubmodulePackages = [];
    for (const submoduleName of submoduleNames) {
      const relativePkgPath = submoduleConfig[submoduleName];
      const submodulePkgPath = path.join(this.config.rootDir, relativePkgPath);
      if (FileUtils.exists(submodulePkgPath)) {
        allSubmodulePackages.push({
          name: submoduleName,
          pkg: FileUtils.readJson(submodulePkgPath),
          dir: path.dirname(submodulePkgPath),
        });
      } else {
        console.warn(`Package.json not found at ${relativePkgPath}`);
      }
    }
    const conflictCollector = new ConflictCollector();
    DependencyUtils.validate(allSubmodulePackages, conflictCollector);
    if (conflictCollector.hasConflicts()) {
      throw new Error(conflictCollector.getReport());
    }
    console.log('✅ No major version conflicts found. Proceeding with merge.');

    const consolidatedDeps = {
      dependencies: {
        ...(mainPackageJson.dependencies || {}),
      },
      devDependencies: {
        ...(mainPackageJson.devDependencies || {}),
      },
      peerDependencies: {
        ...(mainPackageJson.peerDependencies || {}),
      },
    };
    const packageConfig = {
      exports: {
        '.': mainPackageJson.exports?.['.'],
        './components/core': mainPackageJson.exports?.['./components/core'],
        './components/ui': mainPackageJson.exports?.['./components/ui'],
        './components/method': mainPackageJson.exports?.['./components/method'],
      },
      targets: {
        main: mainPackageJson.targets?.main,
        ui: mainPackageJson.targets?.ui,
        method: mainPackageJson.targets?.method,
        core: mainPackageJson.targets?.core,
      },
    };

    console.log(
      `🔍 Processing ${submoduleNames.length} interface submodules:`,
      submoduleNames.join(', ')
    );

    for (const submoduleName of submoduleNames) {
      const relativePkgPath = submoduleConfig[submoduleName];
      this.processor.process(
        submoduleName,
        relativePkgPath,
        consolidatedDeps,
        packageConfig
      );
    }
    mainPackageJson.dependencies = consolidatedDeps.dependencies;
    mainPackageJson.devDependencies = consolidatedDeps.devDependencies;
    mainPackageJson.peerDependencies = consolidatedDeps.peerDependencies;
    mainPackageJson.exports = packageConfig.exports;
    mainPackageJson.targets = packageConfig.targets;

    DependencyUtils.sortDependencies(mainPackageJson);

    FileUtils.writeJson(this.config.mainPackagePath, mainPackageJson);

    console.log(
      '✅ Successfully merged dependencies and updated package.json!'
    );
  }

  // Allow runtime configuration changes
  setPeerDepsToPromote(deps) {
    this.config.peerDepsToPromote = new Set(deps);
    return this;
  }

  setEntryLocations(locations) {
    this.config.entryLocations = locations;
    this.processor = new SubmoduleProcessor(this.config); // Recreate processor
    return this;
  }
}
async function run() {
  // Basic usage
  const consolidator = new PackageConsolidator();
  await consolidator.run();

  // Custom usage example:
  /*
  const customConfig = new Config({
    peerDepsToPromote: ['react', 'react-dom', '@mui/material', 'lodash'],
    entryLocations: ['src/lib', 'src/components', 'lib'],
    entryFiles: ['index.ts', 'index.js', 'main.ts']
  });

  const consolidator = new PackageConsolidator(customConfig);
  await consolidator.run();
  
  // Or chain configuration:
  // await new PackageConsolidator()
  //   .setPeerDepsToPromote(['react', 'react-dom', 'vue'])
  //   .setEntryLocations(['src', 'lib'])
  //   .run();
  */
}

// Export for module usage
module.exports = {
  PackageConsolidator,
  Config,
  FileUtils,
  DependencyUtils,
};

// Run if called directly
if (require.main === module) {
  run().catch((error) => {
    console.error('❌ An error occurred during consolidation:', error);
    process.exit(1);
  });
}
