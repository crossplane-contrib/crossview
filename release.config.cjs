/* eslint-env node */
const { execSync } = require("child_process");

function getCurrentOrigin() {
  try {
    const origin = execSync("git remote get-url origin", {
      encoding: "utf8",
    }).trim();
    if (origin) {
      return origin;
    }
    return null;
  } catch {
    return null;
  }
}

function getRepositoryUrl() {
  const origin = getCurrentOrigin();
  if (origin) {
    return origin;
  }
  const server = (process.env.GITHUB_SERVER_URL || "https://github.com").replace(
    /\/$/,
    "",
  );
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo) {
    return `${server}/${repo}.git`;
  }
  return null;
}

function getGitCurrentBranch() {
  const fromEnv = process.env.GITHUB_REF_NAME;
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const branch = execSync("git branch --show-current", {
      encoding: "utf-8",
    }).trim();
    if (branch) {
      return branch;
    }
    return null;
  } catch {
    return null;
  }
}

const defaultPlugins = [
  [
    "@semantic-release/commit-analyzer",
    { preset: "conventionalcommits" },
  ],
  [
    "@semantic-release/release-notes-generator",
    { preset: "conventionalcommits" },
  ],
];

function getReleasePlugins() {
  return [
    ...defaultPlugins,
    ["@semantic-release/npm", { npmPublish: false }],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle: "# Changelog",
        preset: "conventionalcommits",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json", "package-lock.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/exec",
      {
        publishCmd:
          'echo -n "${nextRelease.version}" > .semantic-release-version',
      },
    ],
  ];
}

let plugins;
const branch = getGitCurrentBranch();

const repositoryUrl = getRepositoryUrl();
if (repositoryUrl == null) {
  throw new Error(
    "Failed to retrieve repository URL from git origin or GITHUB_REPOSITORY",
  );
}

if (branch === "main" || branch === "master") {
  plugins = getReleasePlugins();
} else {
  plugins = defaultPlugins;
}

module.exports = {
  repositoryUrl,
  branches: ["main", "master"],
  tagFormat: "v${version}",
  plugins,
};
