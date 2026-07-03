import type { AiProvider } from './index.js';

const FIXTURE_PATCH = `--- a/src/user.js
+++ b/src/user.js
@@ -1,5 +1,5 @@
 function formatUser(user) {
-  const name = user.name.trim();
+  const name = (user.name ?? 'Anonymous').trim();
   return name || 'Anonymous';
 }
 
 module.exports = { formatUser };
`;

export class DemoProvider implements AiProvider {
  readonly name = 'demo';
  readonly model = 'built-in-fixture-patch';

  async complete(): Promise<string> {
    return FIXTURE_PATCH;
  }
}
