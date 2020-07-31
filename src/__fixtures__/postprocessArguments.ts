import { Linter } from "eslint";

const postprocessArguments = [
  [
    [
      {
        ruleId: "curly",
        severity: 1,
        message: "Expected { after 'if' condition.",
        line: 1,
        column: 1,
        nodeType: "IfStatement",
        messageId: "missingCurlyAfterCondition",
      },
      {
        ruleId: "curly",
        severity: 1,
        message: "Expected { after 'if' condition.",
        line: 2,
        column: 1,
        nodeType: "IfStatement",
        messageId: "missingCurlyAfterCondition",
      },
      {
        ruleId: "curly",
        severity: 1,
        message: "Expected { after 'if' condition.",
        line: 3,
        column: 1,
        nodeType: "IfStatement",
        messageId: "missingCurlyAfterCondition",
      },
    ],
  ],
  "/mock-filename.js",
] as [Linter.LintMessage[][], string];

export { postprocessArguments };
