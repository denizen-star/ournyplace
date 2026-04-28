#!/usr/bin/env node
/**
 * Creates (or no-ops) a GitHub Release for the current package.json version,
 * using CHANGELOG.md for the release body.
 *
 * Auth: GITHUB_TOKEN | GH_TOKEN | GITHUB_RELEASE_TOKEN, or `gh auth token`.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function parseGithubRepo(cwd) {
  const raw = execSync('git remote get-url origin', { encoding: 'utf8', cwd }).trim();
  const m = raw.match(/(?:github\.com[/:]|git@github\.com:)([^/]+)\/([^/.]+)/i);
  if (!m) throw new Error(`Cannot parse owner/repo from git remote: ${raw}`);
  const repo = m[2].replace(/\.git$/i, '');
  return [m[1], repo];
}

function getToken() {
  const t =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_RELEASE_TOKEN;
  if (t) return t.trim();
  try {
    return execSync('gh auth token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function extractChangelogSection(md, version) {
  const marker = `## ${version} -`;
  const i = md.indexOf(marker);
  if (i < 0) throw new Error(`CHANGELOG.md: missing "${marker}" section`);
  let end = md.indexOf('\n## ', i + marker.length);
  if (end < 0) end = md.length;
  return md.slice(i, end).trim();
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version;
  const tagName = `v${version}`;
  const md = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const body = extractChangelogSection(md, version);

  const token = getToken();
  if (!token) {
    console.error(
      'No GitHub API token. Set GITHUB_TOKEN (repo scope) or run: gh auth login',
    );
    process.exit(1);
  }

  const [owner, repo] = parseGithubRepo(root);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const tagUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`;
  let res = await fetch(tagUrl, { headers });
  if (res.status === 200) {
    const j = await res.json();
    console.log(`Release ${tagName} already exists: ${j.html_url}`);
    return;
  }

  const createUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
  res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tag_name: tagName,
      name: `Nyhome v${version}`,
      body,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`GitHub API ${res.status}: ${text}`);
    process.exit(1);
  }
  const j = JSON.parse(text);
  console.log(`Created release: ${j.html_url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
