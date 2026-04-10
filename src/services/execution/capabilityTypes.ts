export type SharedExecutionCapabilityKey =
  | 'prompt_generation_auto_write'
  | 'prompt_generation_draft'
  | 'prompt_generation_reply'
  | 'recording_confirmation'
  | 'unsupported';

export type SharedExecutionCapability<ActionType extends string> = {
  actionType: ActionType;
  capabilityKey: SharedExecutionCapabilityKey;
  executorName: string;
  summary: string;
  supportsExecution: boolean;
};
