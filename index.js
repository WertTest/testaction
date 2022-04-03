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
const token = default_parse("token");

const owner = "WertTest";
const repo = "RepoB";
const repoRegex = /.*<!---repos-start--->(.*)<!---repos-end--->.*/m;
const retrieveRepos = (body) => {

  console.log("###### BODY", JSON.stringify(body));
  const reposBody = body.match(repoRegex);
  console.log("###### REPOS BODY", JSON.stringify(reposBody));
};

const requestWithAuth = request.defaults({
  headers: {
    authorization: `Bearer ${token}`
  }
  // ,
  // mediaType: {
  //   previews: [
  //     "symmetra",
  //   ]
  // } 
});

retrieveRepos(metaIssue.body);

requestWithAuth("post /repos/{owner}/{repo}/issues", {
    token,
    owner,
    repo,
    title: `[META ${metaIssue.number}] ${metaIssue.title}`,
    body: "testbody",
})
  .then(result => {
    console.log("result", result);
    if (result && result.data && result.data.id) {
      core.setOutput('id', result.data.id)
    }
    if (result && result.data && result.data.number) {
      core.setOutput('number', result.data.number)
    }
  })
  .catch(error => {
    console.log("error", error);
  });

  core.setOutput('SELECTED_COLOR', 'green');