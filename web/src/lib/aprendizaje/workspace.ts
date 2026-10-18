import { getStore } from "../storage";
import type { StudyWorkspace } from "./model";

export * from "./model";

/** Resolves localStorage lazily through the same export/delete-aware app store. */
export function readStudyWorkspace(): StudyWorkspace { return getStore().loadStudyWorkspace(); }
/** False means the workspace is available only in memory for this tab. */
export function saveStudyWorkspace(workspace: StudyWorkspace): boolean { return getStore().saveStudyWorkspace(workspace); }
export function clearStudyWorkspace(): void { getStore().clearStudyWorkspace(); }
