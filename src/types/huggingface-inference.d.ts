declare module '@huggingface/inference' {
  export class HfInference {
    constructor(accessToken?: string)
    featureExtraction(options: {
      model: string
      inputs: string | string[]
    }): Promise<number[] | number[][]>
  }
}