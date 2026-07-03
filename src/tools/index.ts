import { autofixTool } from './autofixTool.js';
import { diagnoseTool } from './diagnoseTool.js';
import { firewallTools } from './firewallTools.js';
import { patchReviewTool } from './patchReviewTool.js';

export { autofixTool, type AutoFixToolInput, type AutoFixToolProvider } from './autofixTool.js';
export { diagnoseTool, type DiagnoseToolInput } from './diagnoseTool.js';
export {
  firewallCheckCommandTool,
  firewallCheckInputTool,
  firewallCheckPatchTool,
  firewallRedactTool,
  firewallScanRepoTool,
  type FirewallCheckCommandToolInput,
  type FirewallCheckInputToolInput,
  type FirewallCheckPatchToolInput,
  type FirewallRedactToolInput,
  type FirewallScanRepoToolInput
} from './firewallTools.js';
export { patchReviewTool, type PatchReviewToolInput } from './patchReviewTool.js';
export * from './types.js';

export const devloopTools = [diagnoseTool, autofixTool, patchReviewTool, ...firewallTools] as const;

export const devloopToolMap = Object.fromEntries(
  devloopTools.map((tool) => [tool.name, tool])
) as {
  [Tool in (typeof devloopTools)[number] as Tool['name']]: Tool;
};
