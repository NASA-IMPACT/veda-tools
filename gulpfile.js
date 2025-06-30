const { src, series, parallel } = require("gulp");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// List all submodule paths (adjust as needed)
const submodules = [
  "src/components/interfaces/emit",
  "src/components/interfaces/noaa",
  "src/components/interfaces/goes/goes-plume-viewer",
  "src/components/interfaces/nist/nist-interface",
  "src/components/interfaces/urban/urban-dashboard"
];

function cleanCache(cb) {
  exec("yarn cache clean", (err, stdout, stderr) => {
    if (err) return cb(err);
    console.log(stdout);
    cb();
  });
}

function cleanSubmodules(cb) {
  for (const dir of submodules) {
    const fullPath = path.resolve(__dirname, dir);
    const removeList = ["node_modules", ".parcel-cache", "yarn.lock"];

    for (const file of removeList) {
      const target = path.join(fullPath, file);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`✅ Removed ${target}`);
      }
    }
  }
  cb();
}

function installDeps(cb) {
  let remaining = submodules.length;

  submodules.forEach((dir) => {
    const fullPath = path.resolve(__dirname, dir);
    exec("yarn install", { cwd: fullPath }, (err, stdout, stderr) => {
      if (err) return cb(err);
      console.log(`📦 Installed in ${dir}`);
      if (--remaining === 0) cb();
    });
  });
}

function buildMain(cb) {
  exec("yarn build", (err, stdout, stderr) => {
    if (err) return cb(err);
    console.log(stdout);
    cb();
  });
}

exports.default = series(cleanCache, cleanSubmodules, installDeps, buildMain);