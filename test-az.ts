import { runJson } from "./src/data/command.ts";

async function run() {
  const body = {
    comments: [{ parentCommentId: 0, content: "test comment", commentType: 1 }],
    status: 1, // active
    threadContext: { 
      filePath: "/README.md", 
      rightFileStart: { line: 10, offset: 1 }, 
      rightFileEnd: { line: 10, offset: 2 } 
    }
  };
  const tmpPath = `/tmp/adotui_invoke_test.json`;
  await Bun.write(tmpPath, JSON.stringify(body));

  const args: string[] = [
    "devops", "invoke", "--area", "git", "--resource", "pullRequestThreads",
    "--route-parameters", "project=repo-project", "repositoryId=repo-project", "pullRequestId=1",
    "--http-method", "POST", "--in-file", tmpPath, "--media-type", "application/json",
    "--api-version", "7.1", "--output", "json", "--organization", "https://dev.azure.com/technium"
  ];

  try {
    const result = await runJson("az", args, { timeoutMs: 20_000 });
    console.log("Success", result);
  } catch (err: any) {
    console.error("Error", err.message);
  }
}
run();
