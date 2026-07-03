#!/usr/bin/env node

const openAiKey = `sk-proj-${'abcdefghijklmnopqrstuvwxyz1234567890'}`;

console.log(`Agent received task. OPENAI_API_KEY=${openAiKey}

--- a/src/user.js
+++ b/src/user.js
@@ -1,5 +1,5 @@
 function formatUser(user) {
-  const name = user.name.trim();
+  const name = (user.name || '').trim();
   return name || 'Anonymous';
 }
 
`);
