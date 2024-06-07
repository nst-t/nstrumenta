const alpha = 0.05;
const outlierThresh = 0.15;

export class TimestampManager {
  firstUpdate = true;

  predictedDateMs = 0;

  predictedTsUn = 0;

  prevTsUnSec = 0;

  prevDateMs = 0;

  updateEstimate(date: Date, tsUnwrapped: number) {
    const tsSec = tsUnwrapped * 1e-6;
    const dateMs = date.getTime();
    if (this.firstUpdate) {
      this.firstUpdate = false;
      this.predictedDateMs = dateMs;
    } else {
      const deltaTsForOutlierSec = tsSec - this.prevTsUnSec;
      if (deltaTsForOutlierSec === 0) {
        return;
      }
      const deltaAppDateSec = (dateMs - this.prevDateMs) * 1e-3;
      const diffSec = Math.abs(deltaAppDateSec - deltaTsForOutlierSec);
      if (diffSec > outlierThresh) {
        this.prevDateMs = dateMs;
        this.prevTsUnSec = tsSec;
        return;
      }

      const deltaTsSec = tsSec - this.predictedTsUn * 1e-6;
      const dateTmpMs = this.predictedDateMs + deltaTsSec * 1e3;
      const predictedOffsetSec = (dateTmpMs - dateMs) * 1e-3;

      const factorMs = alpha * predictedOffsetSec * 1e3;
      this.predictedDateMs = dateTmpMs - factorMs;
    }

    this.predictedTsUn = tsUnwrapped;
    this.prevDateMs = dateMs;
    this.prevTsUnSec = tsSec;
  }

  getTsEst(date: Date) {
    // Ts in µs
    const diffTs = (date.getTime() - this.predictedDateMs) * 1e3;
    let newTime = Math.round(this.predictedTsUn + diffTs);
    if (newTime < 0) {
      newTime = 0;
    }
    return newTime;
  }
}