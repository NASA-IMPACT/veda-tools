const fs = require('fs');
const path = require('path');
const semver = require('semver');

// --- Define paths ---
const ROOT_DIR = path.resolve(__dirname, '.');
const MAIN_PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');
const CONFIG_PATH = path.join(ROOT_DIR, 'module-paths.json');

// --- NEW: List of packages to enforce as peer dependencies ---
const PEER_DEPS_TO_PROMOTE = new Set(['react', 'react-dom', '@mui/material']);

/**
 * Merges dependencies. If a package doesn't exist in mainDeps, it's added.
 * If it exists, it's only updated if the new version is higher.
 * @param {object} mainDeps - The main dependencies object to merge into.
 * @param {object} subDeps - The submodule dependencies object.
 */
function mergeDependencies(mainDeps, subDeps) {
  if (!subDeps) return;
  for (const [pkg, version] of Object.entries(subDeps)) {
    if (
      !mainDeps[pkg] ||
      semver.gt(semver.coerce(version), semver.coerce(mainDeps[pkg]))
    ) {
      mainDeps[pkg] = version;
    }
  }
}

/**
 * Finds the entry point file within a submodule's source directory.
 * @param {string} submoduleDir - The absolute path to the submodule's directory.
 * @returns {string} The relative path to the source file.
 */
function findSourceFile(submoduleDir) {
  // 1. Define the paths to check in order of priority
  const locations = [path.join('src', 'lib'), path.join('src', 'components')];
  const entryFiles = ['index.js', 'index.ts'];

  // 2. Check for 'src/lib/index.ts' first
  for (const loc of locations) {
    for (const file of entryFiles) {
      const fullPath = path.join(submoduleDir, loc, file);
      // If the file exists, we've found our match. Return its path immediately.
      if (fs.existsSync(fullPath)) {
        return path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
      }
    }
  }

  // 4. If neither is found, show a warning and return a default fallback path
  console.warn(
    `⚠️ Could not find entry file for  ${submoduleDir}. Using default.`
  );

  return null;
}

async function run() {
  console.log('🚀 Merging submodule packages into main package.json...');

  // 1. Read the main package.json and the submodule config file
  const mainPackageJson = JSON.parse(
    fs.readFileSync(MAIN_PACKAGE_PATH, 'utf-8')
  );
  const submoduleConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const submoduleNames = Object.keys(submoduleConfig);

  // Initialize with dependencies from the main package.json to preserve them.
  const consolidatedDeps = {
    dependencies: { ...(mainPackageJson.dependencies || {}) },
    devDependencies: { ...(mainPackageJson.devDependencies || {}) },
    peerDependencies: { ...(mainPackageJson.peerDependencies || {}) },
  };

  // Preserve the original, non-interface targets and exports
  const baseTargets = {
    main: mainPackageJson.targets.main,
    ui: mainPackageJson.targets.ui,
    method: mainPackageJson.targets.method,
    core: mainPackageJson.targets.core,
  };
  const baseExports = {
    '.': mainPackageJson.exports['.'],
    './components/core': mainPackageJson.exports['./components/core'],
    './components/ui': mainPackageJson.exports['./components/ui'],
    './components/method': mainPackageJson.exports['./components/method'],
  };

  console.log(
    `🔍 Processing ${submoduleNames.length} interface submodules from config:`,
    submoduleNames.join(', ')
  );

  // 2. Process each submodule from the configuration file
  for (const submoduleName of submoduleNames) {
    const relativePkgPath = submoduleConfig[submoduleName];
    const submodulePkgPath = path.join(ROOT_DIR, relativePkgPath);

    if (!fs.existsSync(submodulePkgPath)) {
      console.warn(
        `❗️ Warning: package.json not found at configured path: ${relativePkgPath}. Skipping.`
      );
      continue;
    }

    const submodulePkg = JSON.parse(fs.readFileSync(submodulePkgPath, 'utf-8'));
    const effectiveSubmodulePath = path.dirname(submodulePkgPath);

    // --- NEW: Promote specified packages from dependencies to peerDependencies ---
    if (submodulePkg.dependencies) {
      for (const pkgName of PEER_DEPS_TO_PROMOTE) {
        if (submodulePkg.dependencies[pkgName]) {
          const depToPromote = {
            [pkgName]: submodulePkg.dependencies[pkgName],
          };
          mergeDependencies(consolidatedDeps.peerDependencies, depToPromote);
          // Remove from original dependencies to prevent it from being added there
          delete submodulePkg.dependencies[pkgName];
        }
      }
    }

    // Merge the remaining dependencies, strictly respecting their original type
    mergeDependencies(consolidatedDeps.dependencies, submodulePkg.dependencies);
    mergeDependencies(
      consolidatedDeps.devDependencies,
      submodulePkg.devDependencies
    );
    mergeDependencies(
      consolidatedDeps.peerDependencies,
      submodulePkg.peerDependencies
    );

    // Generate dynamic exports and targets entries
    baseExports[`./interfaces/${submoduleName}`] = {
      import: `./dist/components/interfaces/${submoduleName}/index.js`,
      require: `./dist/components/interfaces/${submoduleName}/index.js`,
    };

    const sourceFilePath = findSourceFile(effectiveSubmodulePath);
    baseTargets[submoduleName] = {
      source: sourceFilePath,
      distDir: `dist/components/interfaces/${submoduleName}`,
      context: 'node',
      isLibrary: true,
    };
  }

  // 3. Update main package.json with the merged data
  mainPackageJson.dependencies = consolidatedDeps.dependencies;
  mainPackageJson.devDependencies = consolidatedDeps.devDependencies;
  mainPackageJson.peerDependencies = consolidatedDeps.peerDependencies;

  // Sort dependencies alphabetically for consistency
  Object.keys(mainPackageJson).forEach((key) => {
    if (key.toLowerCase().includes('dependencies')) {
      mainPackageJson[key] = Object.fromEntries(
        Object.entries(mainPackageJson[key]).sort(([a], [b]) =>
          a.localeCompare(b)
        )
      );
    }
  });

  mainPackageJson.exports = baseExports;
  mainPackageJson.targets = baseTargets;

  // 4. Write the updated package.json back to disk
  fs.writeFileSync(
    MAIN_PACKAGE_PATH,
    JSON.stringify(mainPackageJson, null, 2) + '\n'
  );

  console.log('✅ Successfully merged dependencies and updated package.json!');
}

run().catch((error) => {
  console.error('❌ An error occurred during consolidation:', error);
  process.exit(1);
});
