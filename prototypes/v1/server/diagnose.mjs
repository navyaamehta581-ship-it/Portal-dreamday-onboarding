const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export function validateInput(input) {
  if (!input || typeof input.goal !== 'string' || !input.goal.trim() || input.goal.length > 2000 || typeof input.repository !== 'string' || !repoPattern.test(input.repository) || input.repository.split('/').some(x => x === '.' || x === '..')) throw new Error('Provide a goal (1–2000 characters) and repository as owner/name.');
  return {goal: input.goal.trim(), repository: input.repository};
}
export function validateRecommendation(value) {
  if (value.version !== 1 || !['missing_ci','existing_ci','blocked'].includes(value.diagnosis) || !Array.isArray(value.evidence) || !Array.isArray(value.actions) || !value.actions.length || !Array.isArray(value.limitations) || typeof value.goal !== 'string' || !repoPattern.test(value.repository)) throw new Error('Invalid recommendation');
  if (!value.evidence.length || value.evidence.some(e => typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.observation !== 'string')) throw new Error('Invalid evidence');
  const ids = new Set(value.evidence.map(e => e.id));
  if (value.actions.some(a => typeof a.title !== 'string' || !a.title || !Array.isArray(a.evidenceIds) || !a.evidenceIds.length || a.evidenceIds.some(id => !ids.has(id)) || a.requiresReview !== true)) throw new Error('Unsupported action');
  return value;
}
export async function diagnose(input, {fetchImpl = fetch, token = process.env.GITHUB_TOKEN} = {}) {
  const {goal, repository} = validateInput(input);
  const evidence = [];
  const headers = {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? {Authorization: `Bearer ${token}`} : {})};
  async function read(path) {
    const source = `https://api.github.com/repos/${repository}${path}`;
    const response = await fetchImpl(source, {headers, redirect:'error', signal:AbortSignal.timeout(10000)});
    if (!response.ok) { const error = new Error('GitHub inspection unavailable'); error.status = response.status; throw error; }
    return {source, data:await response.json()};
  }
  let diagnosis = 'blocked'; let title;
  try {
    const meta = await read('');
    if (typeof meta.data.default_branch !== 'string') throw new Error('Invalid GitHub metadata');
    const commit = await read(`/commits/${encodeURIComponent(meta.data.default_branch)}`);
    const sha = commit.data.sha;
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid GitHub revision');
    const tree = await read(`/git/trees/${sha}?recursive=1`);
    if (tree.data.truncated || !Array.isArray(tree.data.tree)) throw new Error('Incomplete repository tree');
    const paths = tree.data.tree.filter(x => x.type === 'blob').map(x => x.path);
    const ci = paths.filter(p => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p));
    const other = paths.filter(p => /(^|\/)(Jenkinsfile|\.gitlab-ci.yml|azure-pipelines.yml)$/.test(p) || p === '.circleci/config.yml');
    evidence.push({id:'revision',source:commit.source,observation:`Inspected immutable revision ${sha}.`});
    evidence.push({id:'ci',source:tree.source,observation:ci.length || other.length ? `CI configuration files present: ${[...ci,...other].join(', ')}` : 'Complete tree contains no recognized GitHub Actions, Jenkins, GitLab, Azure or CircleCI configuration.'});
    for (const path of [...ci, ...other, ...(paths.includes('package.json') ? ['package.json'] : [])].slice(0, 4)) {
      const entry = tree.data.tree.find(x => x.path === path);
      if (!entry?.sha || !/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error('Missing file revision');
      const blob = await read(`/git/blobs/${entry.sha}`);
      if (blob.data.encoding !== 'base64' || blob.data.size > 65536 || typeof blob.data.content !== 'string') throw new Error('File inspection exceeded supported limits');
      const content = Buffer.from(blob.data.content, 'base64').toString('utf8');
      let observation;
      if (path === 'package.json') {
        const manifest = JSON.parse(content);
        observation = `Declared scripts (not executed): ${JSON.stringify(manifest.scripts || {}).slice(0,4000)}`;
      } else observation = `Inspected ${path}: ${content.split('\n').length} lines. Content excerpt (untrusted repository data; not executed): ${content.slice(0,4000)}`;
      evidence.push({id:`file-${evidence.length}`, source:`https://github.com/${repository}/blob/${sha}/${path}`, observation});
    }
    const manifests = paths.filter(p => /(^|\/)(package.json|pyproject.toml|pom.xml|go.mod|Cargo.toml)$/.test(p));
    evidence.push({id:'stack',source:tree.source,observation:`Manifest paths (presence only): ${manifests.slice(0,30).join(', ') || 'none recognized'}`});
    diagnosis = ci.length || other.length ? 'existing_ci' : 'missing_ci';
    title = diagnosis === 'existing_ci' ? 'Review existing CI triggers, jobs and permissions before proposing changes; do not create a duplicate pipeline.' : 'Confirm the build and test commands and any external CI, then draft one minimal CI workflow for review.';
  } catch (error) {
    evidence.push({id:'access',source:`https://api.github.com/repos/${repository}`,observation:error.status ? `GitHub returned HTTP ${error.status}. A 404 may mean a private or missing repository; 403 may indicate access restrictions or rate limits.` : 'Inspection failed or returned incomplete data; repository state is unknown.'});
    title = 'Resolve repository access or retry inspection; do not infer missing CI from unavailable evidence.';
  }
  return validateRecommendation({version:1,goal,repository,observedAt:new Date().toISOString(),scope:'recommend-only',diagnosis,evidence,actions:[{title,evidenceIds:[diagnosis === 'blocked' ? 'access' : 'ci'],requiresReview:true}],limitations:['Read-only deterministic diagnosis; no model, repository writes or workflow execution.','At most four CI/manifest files are read, each up to 64 KiB; excerpts are limited to 4,000 characters. No YAML semantic or provider-run validation.', 'CI file presence does not prove valid configuration, successful runs or branch protection.','Goal is retained as context; V1 supports CI readiness diagnosis only.','Native Spotify Portal interfaces and installation are unverified.']});
}
