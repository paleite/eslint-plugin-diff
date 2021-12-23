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
    return this.inclusiveLowerBound <= n && n < this.exclusiveUpperBound;
  }
}

export { Range };
