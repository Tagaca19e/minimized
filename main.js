const core = require('@actions/core');
const github = require('@actions/github');
const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const csso = require('csso');
const { minify } = require('terser');

const { Octokit } = require('@octokit/core');
const { createPullRequest } = require('octokit-plugin-create-pull-request');
const MyOctokit = Octokit.plugin(createPullRequest);

/**
 * Reads the personal access token and desired directory. Minifies JS and CSS 
 * files using 'csso' and 'terser' and push those changes within a new branch 
 * to create a PR.
 */
(async function init() {
  try {
    let directory = core.getInput('directory');
    // Get passed ev variable.
    const token = process.env.GITHUB_TOKEN;

    // Validate token.
    if (!token) {
      throw new Error(
        `Token not found. Please, set a secret token in your repository!`
      );
    }

    // Check if the current branch is already minified.
    const currentBranch = github.context.ref.slice(9);
    if (currentBranch.startsWith('minified_')) {
      console.log(
        `Code has been minifed. Branch ${currentBranch} can be merged now.`
      );
      return;
    }

    const pluginOctokit = new MyOctokit({
      auth: token,
    });
    const context = github.context;
    const repoInfo = context.repo;

    if (
      directory == undefined ||
      irectory == null ||
      directory.startsWith('.')
    ) {
      directory = '';
    }

    const options = {
      dot: true,
      ignore: ['node_modules/**/*'],
    };

    const pattern = `${directory}**/*.{css,js}`;
    const newBranchName = 'minimized_' + Math.random().toString(36).slice(2);
    glob(pattern, options, function (error, files) {
      if (error) {
        throw new Error('File not found! Please, check the directory.');
      };

      let minifiedFiles = [];
      files.forEach(function (file) {
        Promise.all([minifyFile(file)])
          .then(function (result) {
            minifiedFiles.push({
              path: file,
              content: result[0],
            });
          })
          .finally(async function () {
            let encodedStructure = {};

            // Create files for for minified content.
            if (
              minifiedFiles.length === files.length &&
              !currentBranch.startsWith('minimized') &&
              files.length !== 0
            ) {
              minifiedFiles.forEach(function (eachData) {
                encodedStructure[eachData.path] = eachData['content'];
              });

              // setting up pr description
              let prDescription = '### File Changes:\n';
              files.forEach(function (f) {
                prDescription += `- **${f}** \n`;
              });

              // Create a new branch and push the minified files.
              await pluginOctokit
                .createPullRequest({
                  owner: repoInfo.owner,
                  repo: repoInfo.repo,
                  title: `Minified ${files.length} files`,
                  body: prDescription,
                  head: newBranchName,
                  changes: [
                    {
                      files: encodedStructure,
                      commit: `Minified ${files.length} files`,
                    },
                  ],
                })
                .then(function (result) {
                  // Logging result in github action logs.
                  const logInfo = {
                    'Pull request url': result.data.url,
                    'Pull request title': result.data.title,
                    'Sent by': result.data.user.login,
                    'Total number of commits': result.data.commits,
                    Additions: result.data.additions,
                    Deletions: result.data.deletions,
                    'Number of files changed': result.data.changed_files,
                  };
                  console.table(logInfo);
                })
            }
          })
          .catch(function (error) {
            throw new Error(error);
          });
      });
    });
  } catch (error) {
    throw new Error(error);
  }
})();

/**
 * Minifies CSS and JavaScript files using terser and csso.
 * @param {string} file - File to be minified.
 * @return {string} - Minified file content.
 */
async function minifyFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const extension = path.extname(file);

  // Check for file extension and minify accordingly.
  if (extension === '.js') {
    const result = await minify(content, {
      compress: true,
    });
    return result.code;
  } else if (extension === '.css') {
    return csso.minify(content).css;
  }
}
