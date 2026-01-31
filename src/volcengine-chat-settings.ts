export interface VolcengineChatSettings {
  /**
   * Temperature for sampling. Higher values make output more random.
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate.
   */
  maxTokens?: number;

  /**
   * Top-p (nucleus) sampling.
   */
  topP?: number;

  /**
   * Frequency penalty.
   */
  frequencyPenalty?: number;

  /**
   * Presence penalty.
   */
  presencePenalty?: number;

  /**
   * Stop sequences.
   */
  stop?: string[];

  /**
   * User identifier for tracking.
   */
  user?: string;
}
