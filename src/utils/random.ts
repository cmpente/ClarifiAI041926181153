/**
 * Deterministic PRNG utility.
 * Uses a seeded Mulberry32 algorithm.
 */

export class DeterministicPRNG {
  private state: number;

  constructor(seed?: number) {
    if (seed === undefined) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      this.state = array[0];
    } else {
      this.state = seed;
    }
  }

  /**
   * Returns a random number between 0 (inclusive) and 1 (exclusive).
   */
  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer between min (inclusive) and max (exclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Shuffles an array in place using the Fisher-Yates algorithm.
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// Global instance for convenience, though it's better to seed per session if needed
export const prng = new DeterministicPRNG();
