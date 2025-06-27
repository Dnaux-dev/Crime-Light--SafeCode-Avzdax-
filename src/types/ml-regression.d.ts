declare module 'ml-regression' {
    export class PolynomialRegression {
      constructor(X: number[][], y: number[], degree: number);
      predict(features: number[]): number;
      train(): void;
    }
  }