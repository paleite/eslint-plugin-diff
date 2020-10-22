export const diff = `diff --git a/fixme.js b/fixme.js
index 4886604..83c3014 100644
--- a/fixme.js
+++ b/fixme.js
@@ -1,0 +2,2 @@ if (new Date().getTime()) console.log("curly");
+if (new Date().getTime()) console.log("curly");
+if (new Date().getTime()) console.log("curly");`;

export const staged = `diff --git a/fixme.js b/fixme.js
index 4886604..3238811 100644
--- a/fixme.js
+++ b/fixme.js
@@ -1,0 +2 @@ if (new Date().getTime()) console.log("curly");
+if (new Date().getTime()) console.log("curly");`;

export const hunks = `diff --git a/dirty.js b/dirty.js
index 4d2637c..99dc494 100644
--- a/dirty.js
+++ b/dirty.js
@@ -1 +0 @@
-
@@ -3,7 +2,4 @@ function myFunc() {
-
-
-
-if (!myFunc(true == myVar))
-  myRes = false,
-  someotherThing = null
-  unrelated = true;
+  if (true == myVar)
+    if (true == myVar)
+      if (true == myVar) if (true == myVar) if (true == myVar) return;
+}
@@ -10,0 +7,2 @@ if (!myFunc(true == myVar))
+if (!myFunc(true == myVar)) (myRes = false), (someotherThing = null);
+unrelated = true;`;

export const includingOnlyRemovals = `diff --git a/dirty.js b/dirty.js
index cb3c131..874b8f9 100644
--- a/dirty.js
+++ b/dirty.js
@@ -1,0 +2,2 @@ if (new Date().getTime()) console.log("curly");
+if (new Date().getTime()) console.log("curly");
+if (new Date().getTime()) console.log("curly");
@@ -17,2 +16,0 @@ import { a } from "../components/a";
-import { b } from "../context/b";
-import { c } from "../context/c";`;

export const filenamesAB = `a/dirty.js
b/dirty.js
`;

export const filenamesA = `a/dirty.js
`

export const diffFileList = "file1\nfile2\nfile3\n"
