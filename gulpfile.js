const { series } = require('gulp');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * NEW: Runs the package.json consolidation script.
 */
function consolidatePackages(cb) {
  console.log('🔧 Consolidating package.json from consolidate.js...');
  exec('node consolidate.js', (err, stdout, stderr) => {
    console.log(stdout); // Log output from the script
    if (stderr) {
      console.error(stderr);
    }
    cb(err); // Signal task completion to Gulp
  });
}
/**
 * NEW: Commits package.json if it has been changed by the consolidation script.
 * This is designed to run in a CI/CD pipeline.
 */
function commitPackageJson(cb) {
  try {
    // Check if package.json has been modified
    const status = execSync('git status --porcelain package.json')
      .toString()
      .trim();

    if (status) {
      console.log('📝 package.json has changes, committing...');
      const actor = process.env.GITHUB_ACTOR || 'CI Bot';
      const actorEmail = `${actor}@users.noreply.github.com`;

      // Configure git user with the actor's identity
      execSync(`git config --global user.name "${actor}"`);
      execSync(`git config --global user.email "${actorEmail}"`);

      // Stage and commit the file
      execSync('git add package.json');
      execSync('git commit -m "feat: sync package.json from submodules"');

      // Push the commit back to the remote repository
      execSync('git push');

      console.log('✅ package.json committed and pushed successfully.');
    } else {
      console.log('✅ package.json has no changes, skipping commit.');
    }
    cb();
  } catch (error) {
    console.error('❌ Error committing package.json:', error.message);
    cb(error);
  }
}

/**
 * Dynamically parses the .gitmodules file to get submodule paths.
 * This avoids hardcoding paths and makes the script portable.
 * @returns {string[]} An array of submodule paths.
 */
function getSubmodules() {
  const gitmodulesPath = path.join(__dirname, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) {
    console.log(
      '✅ No .gitmodules file found, proceeding without submodule tasks.'
    );
    return [];
  }

  try {
    // Use git config to reliably parse the .gitmodules file
    const stdout = execSync(
      'git config --file .gitmodules --get-regexp path'
    ).toString();
    //- The output is in the format 'submodule.<name>.path <path>'
    //- We split by newline, then by space, and take the last element (the path)
    return stdout
      .trim()
      .split('\n')
      .map((line) => line.split(' ')[1]);
  } catch (error) {
    console.error(
      '❌ Error parsing .gitmodules file. Please ensure it is formatted correctly.'
    );
    // Exit gracefully if parsing fails
    process.exit(1);
  }
}

// Get the list of submodules automatically
const submodules = getSubmodules();

/**
 * 1. Initializes and updates git submodules.
 * Essential for CI/CD environments.
 */
function initSubmodules(cb) {
  // Only run if submodules are defined
  if (submodules.length === 0) {
    return cb();
  }
  console.log('Submodules found. Initializing...');
  exec('git submodule update --init --recursive', (err, stdout, stderr) => {
    if (err) return cb(err);
    console.log('✅ Git submodules initialized and updated.');
    console.log(stdout);
    cb();
  });
}

/**
 * 2. Cleans the global Yarn cache.
 */
// function cleanCache(cb) {
//   exec('yarn cache clean', (err, stdout, stderr) => {
//     if (err) return cb(err);
//     console.log(stdout);
//     cb();
//   });
// }

/**
 * 3. Removes generated files from each submodule directory.
 */
// function cleanSubmodules(cb) {
//   if (submodules.length === 0) {
//     return cb();
//   }
//   for (const dir of submodules) {
//     const fullPath = path.resolve(__dirname, dir);
//     const removeList = ['node_modules', '.parcel-cache', 'yarn.lock'];

//     for (const file of removeList) {
//       const target = path.join(fullPath, file);
//       if (fs.existsSync(target)) {
//         fs.rmSync(target, { recursive: true, force: true });
//         console.log(`🧹 Removed ${target}`);
//       }
//     }
//   }
//   cb();
// }

/**
 * 4. Installs dependencies in each submodule SEQUENTIALLY.
 */
// function installDeps(cb) {
//   if (submodules.length === 0) {
//     return cb();
//   }
//   const modulesToInstall = [...submodules];

//   function installNext(err) {
//     if (err) return cb(err);
//     if (modulesToInstall.length === 0) return cb();

//     const dir = modulesToInstall.shift();
//     const fullPath = path.resolve(__dirname, dir);

//     console.log(`📦 Installing dependencies in ${dir}...`);
//     exec('yarn install', { cwd: fullPath }, (err, stdout, stderr) => {
//       if (err) {
//         console.error(stderr);
//         return installNext(err);
//       }
//       console.log(`✅ Finished install in ${dir}`);
//       installNext();
//     });
//   }
//   installNext();
// }

/**
 * 5. Runs the main build script for the root project.
 */
function buildMain(cb) {
  console.log('🚀 Building libraries');
  exec('yarn build', (err, stdout, stderr) => {
    if (err) return cb(err);
    console.log(stdout);
    cb();
  });
}

// Define the default Gulp task sequence
exports.default = series(
  initSubmodules,
  consolidatePackages,
  buildMain,
  commitPackageJson
);
