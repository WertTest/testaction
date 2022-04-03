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
const repoRegex = /.*<!---repos-start--->(.*)<!---repos-end--->.*/ms;
const extractReposRegex = /- \[.\] ([^\r]*)/ms;

const retrieveRepos = (body) => {
  const reposBody = body.match(repoRegex)[1];
  if(reposBody){
    return reposBody.split('\r\n')
                              .filter(line => line.startsWith('- ['))
                              .map(line => line.match(extractReposRegex)[1]);
  }
  return [];
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



const createIssue = (repo) => requestWithAuth("post /repos/{owner}/{repo}/issues", {
  token,
  owner,
  repo,
  title: `[META ${metaIssue.number}] ${metaIssue.title}`,
  body: "testbody",
})
.then(result => {
  return result;
})
.catch(error => {
  console.log("error", error);
});


const run = async () => {
  const createdIssues = [];
  const repos = retrieveRepos(metaIssue.body);
  for (const repo of repos) {
    const response = await createIssue(repo);
    console.log('NR', JSON.stringify(createdIssues));
    createdIssues.push(`${repo}/${response.data.number}`);
  }

  console.log('OUTPUT', JSON.stringify(createdIssues));
  core.setOutput('createdIssues', JSON.stringify(createdIssues));
};

run();


