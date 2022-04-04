const core = require("@actions/core");
const { request } = require("@octokit/request");
const github = require("@actions/github");

function parse_array(input_name) {
  const input_value = core.getInput(input_name)
  if (input_value === "") {
    return undefined; 
  }
  if (input_value === "<<EMPTY>>") {
    return [];
  }
  return input_value.split(",");
}

function parse_boolean(input_name) {
  const input_value = core.getInput(input_name);
  return input_value === "true";
}

function parse_object(input_name) {
  const input_value = core.getInput(input_name);
  return JSON.parse(input_value);
}

function default_parse(input_name) {
  const input_value = core.getInput(input_name);
  if (!input_value) {
    if (input_name === 'owner') {
      return github.context.repo.owner;
    } else if (input_name === 'repo') {
      return github.context.repo.repo;
    }
  }
  return input_value || undefined;
}

const metaIssue = parse_object("metaIssue");
const metaIssueRepo = metaIssue.repository_url.match(/https.*\/repos\/[^\/]*\/(.*)/)[1];
const owner = metaIssue.repository_url.match(/https.*\/repos\/([^\/]*)\/.*/)[1];
const token = default_parse("token");
const bodyRegex = /(.*)(<!---repos-start--->.*<!---repos-end--->)(.*)/ms;
const extractReposRegex = /- \[.\] ([^\r]*)/ms;

const requestWithAuth = request.defaults({
  headers: {
    authorization: `Bearer ${token}`
  }
});

const createIssue = (repo, title, body) => requestWithAuth("post /repos/{owner}/{repo}/issues", {
  token,
  owner,
  repo,
  title,
  body,
})
.then(result => {
  return result;
})
.catch(error => {
  console.log("error", error);
});

const updateMetaIssue = async (agentIssues, specIssue, oldBody) => {
  var overviewSection = "";
  if (specIssue) {
    overviewSection = overviewSection + "## Spec Issue\r\n";
    overviewSection = overviewSection + `- [ ] https://github.com/${specIssue}\r\n`;
    overviewSection = overviewSection + "\r\n";
  }
  if(agentIssues.length > 0){
    overviewSection = overviewSection + "## Agent Issues\r\n";
    for (const aIssue of agentIssues) {
      overviewSection = overviewSection + `- [ ] https://github.com/${aIssue}\r\n`;
    }
  }

  const newBody = oldBody + overviewSection;
  await requestWithAuth("patch /repos/{owner}/{repo}/issues/{issue_number}", {
    token,
    owner,
    repo: metaIssueRepo,
    issue_number: metaIssue.number,
    body: newBody,
  })
  .then(result => {
    return result;
  })
  .catch(error => {
    console.log("error", error);
  });
};

const run = async () => {
  const createdIssues = [];
  const bodyMatchArray = metaIssue.body.match(bodyRegex);
  if(bodyMatchArray || bodyMatchArray.length === 4){
    var repos = bodyMatchArray[2].split('\n').filter(line => line.startsWith('- [x]')).map(line => line.match(extractReposRegex)[1].trim());
    
    var specIssueNumber = undefined;
    if(repos.some(r => r.toLowerCase().startsWith('spec'))){
      repos = repos.filter(r => !(r.toLowerCase().startsWith('spec')));
      const specIssueBody = `See meta issue for the description:\r\n- [ ] ${metaIssue.html_url}`
      const specResponse = await createIssue(metaIssueRepo, `[META ${metaIssue.number}] Spec: ${metaIssue.title}`, specIssueBody);
      specIssueNumber = specResponse.data.number;
    }

    const subIssueBody = `See meta issue${specIssueNumber ? ' and spec ' : ' '}for the description and details:\r\n- [ ] Meta issue: ${metaIssue.html_url}\r\n`
          + (specIssueNumber ? `- [ ] Spec issue: https://github.com/${owner}/${metaIssueRepo}/issues/${specIssueNumber}\r\n` : '');
    for (const repo of repos) {
      const response = await createIssue(repo, `[META ${metaIssue.number}] ${metaIssue.title}`, subIssueBody);
      if(response.status < 400){
        createdIssues.push(`${owner}/${repo}/issues/${response.data.number}`);
      }
    }

    const metaIssueBody = `${bodyMatchArray[1]}\r\n${bodyMatchArray[3]}\r\n\r\n`;
    const specIssue = specIssueNumber ? `${owner}/${metaIssueRepo}/issues/${specIssueNumber}` : undefined;
    await updateMetaIssue(createdIssues, specIssue, metaIssueBody);
  } else {
    console.log("No issue creation list identified. Skipping execution.", error);
  }

  core.setOutput('createdIssues', JSON.stringify(createdIssues));
};

run();


