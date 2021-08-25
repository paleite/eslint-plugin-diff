import type { Linter } from "eslint";

const postprocessArguments: [Linter.LintMessage[][], string] = [
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
  '/mock filename with quotes ", semicolons ; and spaces.js',
];

export { postprocessArguments };
