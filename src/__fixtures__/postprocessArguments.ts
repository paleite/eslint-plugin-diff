import type { Linter } from "eslint";

const postprocessArguments: [
  [[Linter.LintMessage, ...Linter.LintMessage[]], ...Linter.LintMessage[][]],
  string
] = [
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
        fix: {
          range: [0, 3],
          text: ''
        }
      },
    ],
  ],
  '/mock filename with quotes ", semicolons ; and spaces.js',
];

export { postprocessArguments };
