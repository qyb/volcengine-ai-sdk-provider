export interface VolcengineImageSettings {
  /**
   * Number of images to generate.
   */
  n?: number;

  /**
   * Size of the generated images.
   */
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';

  /**
   * Quality of the generated images.
   */
  quality?: 'standard' | 'hd';

  /**
   * Style of the generated images.
   */
  style?: 'vivid' | 'natural';

  /**
   * Response format.
   */
  responseFormat?: 'url' | 'b64_json';

  /**
   * User identifier for tracking.
   */
  user?: string;
}
