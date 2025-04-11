const debug = process.argv.includes('--debug');

module.exports = {
  hooks: {
    'after:bump': 'yarn && yarn build-lib',
    'after:release': 'echo "VERSION_NUMBER=v${version}" >> "$GITHUB_OUTPUT"'
  },
  git: {
    release: debug ? false : true,
    requireBranch: ["main", "develop"],
    commitMessage: "chore: release v${version}",
    tagName: 'v${version}',
    tagAnnotation: 'Release v${version}',
    pushArgs: ['--follow-tags'],
    requireCleanWorkingDir: debug ? false : true,
    requireUpstream: debug ? false : true,
    getLatestTagFromAllRefs: true
    // changelog: 'git log --pretty=format:%s ${latestTag}...HEAD' // this is overridden by the @release-it/conventional-changelog's changelog
  },
  github: {
    release: debug ? false : true,
    releaseName: "v${version}",
    autoGenerate: false,
    releaseNotes: getReleaseNotes,
  },
  npm: {
    publish: debug ? false : true
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
  if (!config || !config || !config.changelog) return "🦗";
  const changelog = `## What's changed on version:\n` + config.changelog;
  return changelog;
}
