const https = require("https");
const fs = require("fs");

const options = {
  hostname: "api.github.com",
  port: 443,
  path: "/repos/paleite/eslint-plugin-diff/contributors",
  method: "GET",
  headers: {
    "User-Agent": "node.js", // GitHub requires a user-agent header
  },
};

let rawData = "";

const req = https.request(options, (res) => {
  res.setEncoding("utf8");
  res.on("data", (chunk) => {
    rawData += chunk;
  });
  res.on("end", () => {
    try {
      /** @type {{login: string, avatar_url: string, html_url: string}[]} */
      const parsedData = JSON.parse(rawData);

      const contributorsList = parsedData
        .filter(({ login }) => !login.includes("[bot]"))
        .map(
          (contributor) =>
            `- ![${contributor.login}](${contributor.avatar_url}&s=50) [${contributor.login}](${contributor.html_url})`,
        );

      fs.writeFileSync(
        "CONTRIBUTORS.md",
        ["# Contributors", contributorsList.join("\n")].join("\n\n"),
      );
    } catch (e) {
      console.error(e.message);
    }
  });
});

req.on("error", (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
