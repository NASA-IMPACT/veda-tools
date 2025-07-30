const debug = process?.argv?.includes('--debug')||false;

module.exports = {
  hooks: {
    'after:bump': 'yarn && yarn build-lib',
    'after:release': 'echo "VERSION_NUMBER=v${version}" >> "$GITHUB_OUTPUT"'
  },
  git: {
    release: true,
    requireBranch: ["main", "develop"],
    commitMessage: "chore: release v${version}",
    tagName: 'v${version}',
    tagAnnotation: 'Release v${version}',
    pushArgs: ['--follow-tags'],
    requireCleanWorkingDir:  true,
    requireUpstream:  true,
    getLatestTagFromAllRefs: true
    // changelog: 'git log --pretty=format:%s ${latestTag}...HEAD' // this is overridden by the @release-it/conventional-changelog's changelog
  },
  github: {
    release:  true ,
    releaseName: "v${version}",
    autoGenerate: false,
    releaseNotes: getReleaseNotes,
  },
  npm: {
    publish:  true
  },
  publishConfig: {
    registry: "https://registry.npmjs.org"
  },
  plugins: {
    "@release-it/conventional-changelog": {
      "preset": {
        "name": "conventionalcommits",
        "types": [
          {
            "type": "feat",
            "section": '🎉 Features',
          },
          {
            "type": "fix",
            "section": '🐛 Fixes',
          },
          {
            "type": "docs",
            "section": '🚀 Improvements',
          },
          {
            "type": "ci",
            "section": '🚀 Improvements',
          },
          {
            "type": "test",
            "section": '🚀 Improvements',
          },
          {
            "type": "refactor",
            "section": '🚀 Improvements',
          },
          {
            "type": "chore",
            "section": '🚀 Improvements',
          },
          {
            "type": "revert",
            "section": '🐛 Fixes'
          },
        ]
      },
      "infile": false,
    }
  }
}

// helpers
function getReleaseNotes(config) {
  if (!config) {
    console.log('Config is null/undefined, returning default release notes');
    return "## What's changed on version:\n🦗 No changelog available";
  }
  
  if (!config.changelog) {
    console.log('Config.changelog is null/undefined, returning default release notes');
    return "## What's changed on version:\n🦗 No changelog available";
  }
  
  const changelog = `## What's changed on version:\n` + config.changelog;
  return changelog;
}
