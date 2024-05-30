const UINT32_MAX = 4294967295;
const WRAP_AMOUNT = UINT32_MAX + 1;
const WRAP_THRESHOLD = Math.floor(UINT32_MAX / 2);

export class TimestampUnwrap {
  prevTs: number | null = null;

  wrapCnt: number = 0;

  /**
   * Unwrap LPOM timestamp.
   */
  process(currentTs: number) {
    if (this.prevTs === null) {
      this.prevTs = currentTs;
      return currentTs;
    }

    const dt = currentTs - this.prevTs;
    if (dt < -WRAP_THRESHOLD) {
      // Negative wrap check (normal).
      this.wrapCnt += 1;
    } else if (dt > WRAP_THRESHOLD) {
      // Positive wrap check (oscialting around wrap time).
      this.wrapCnt -= 1;
      if (this.wrapCnt < 0) {
        this.wrapCnt = 0;
      }
    }

    const result = currentTs + this.wrapCnt * WRAP_AMOUNT;
    this.prevTs = currentTs;
    return result;
  }
}
