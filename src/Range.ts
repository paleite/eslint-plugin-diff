import { log } from "./logging";

class Range {
  private readonly inclusiveLowerBound: Readonly<number>;
  private readonly exclusiveUpperBound: Readonly<number>;

  constructor(
    inclusiveLowerBound: Readonly<number>,
    exclusiveUpperBound: Readonly<number>
  ) {
    if (inclusiveLowerBound >= exclusiveUpperBound) {
      throw TypeError(
        `inclusiveLowerBound must be strictly less than exclusiveUpperBound: ${inclusiveLowerBound} >= ${exclusiveUpperBound}`
      );
    }

    this.inclusiveLowerBound = inclusiveLowerBound;
    this.exclusiveUpperBound = exclusiveUpperBound;
  }

  isWithinRange(n: Readonly<number>): boolean {

    log(
      `Checking if ${n} is within range ${this.inclusiveLowerBound} - ${this.exclusiveUpperBound}`
    );
    const result =
      this.inclusiveLowerBound <= n && n < this.exclusiveUpperBound;
    return result;
  }
}

export { Range };
