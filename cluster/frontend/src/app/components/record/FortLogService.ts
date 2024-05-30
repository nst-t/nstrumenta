import { TimestampUnwrap } from "./TimestampUnwrap";

export class FortLogService {
  static readonly COMPANY_ID = 0x04A1;

  static readonly SERVICE_UUID = '00000000-0001-11ea-8d71-362b9e155667'.toLowerCase();
  
  static readonly NOTIFY_UUID = '00000001-0001-11ea-8d71-362b9e155667'.toLowerCase();

  /** 35Hz should allow full DsLinAcc which is 30Hz. */
  static readonly DEFAULT_SAMPLE_RATE = 35;

  tsUnwrap = new TimestampUnwrap();

  reset() {
    this.tsUnwrap.prevTs = null;
  }

  decode(dv: DataView): OutputLog | null {
    if (dv.byteLength) {
      const id = dv.getUint8(0);
      switch (id) {
        case LogIds.DOM_DS_LIN_ACC: {
          if (dv.byteLength === 18) {
            const log: DsLinAccLog = {
              id,
              ...this.makeSensor3AxisLog(dv),
            }
            return log;
          }
          break;
        }
        case LogIds.PRESSURE: {
          if (dv.byteLength === 10) {
            const log: PressureLog = {
              id,
              ts: this.tsUnwrap.process(dv.getUint32(2, true)),
              hpaValue: dv.getFloat32(6, true),
              values: [],
            };
            log.values = [log.ts, log.hpaValue];
            return log;
          }
          break;
        }
        case LogIds.DOM_STEP_INFO: {
          if (dv.byteLength === 18) {
            // TODO: Should we convert heading/step length to lat/lon here?
            const log: DomStepInfoLog = {
              id,
              ts: this.tsUnwrap.process(dv.getUint32(2, true)),
              stepNum: dv.getUint16(6, true),
              heading: dv.getFloat32(8, true),
              conf: dv.getUint16(12, true),
              stepLength: dv.getFloat32(14, true),
              values: [],
            }
            log.values = [
              log.ts, log.stepNum, log.heading, log.conf, log.stepLength
            ];
            return log;
          }
          break;
        }
        case LogIds.TEMPERATURE: {
          if (dv.byteLength === 10) {
            const log: TemperatureLog = {
              id,
              ts: this.tsUnwrap.process(dv.getUint32(2, true)),
              degrees: dv.getFloat32(6, true),
              values: [],
            };
            log.values = [log.ts, log.degrees];
            return log;
          }
          break;
        }
        case LogIds.TIMESTAMP_FULL: {
          if (dv.byteLength === 10) {
            const log: TimestampFullLog = {
              id,
              ts: this.tsUnwrap.process(dv.getUint32(2, true)),
              upper: dv.getUint32(6, true),
              values: [],
            };
            log.values = [log.ts, log.upper];
            return log;
          }
          break;
        }
        default:
          console.log('Unhandled log Id:', id);
          break;
      }
    }
    return null
  }

  private makeSensor3AxisLog(dv: DataView): Sensor3AxisLog {
    const log: Sensor3AxisLog = {
      ts: this.tsUnwrap.process(dv.getUint32(2, true)),
      x: dv.getFloat32(6, true),
      y: dv.getFloat32(10, true),
      z: dv.getFloat32(14, true),
      values: [],
    }
    log.values = [
      log.ts, log.x, log.y, log.z
    ];
    return log;
  }
}

export const enum LogIds {
  MAG_RAW = 1,
  HPR_QMA = 5,
  TEMPERATURE = 7,
  ACCEL_RAW = 15,
  GYRO_RAW = 62,
  QMA = 77,
  HPR_9AXIS = 85,
  MAG_AUTOCAL = 93,
  ACCEL_AUTOCAL = 99,
  GYRO_AUTOCAL = 108,
  TIMESTAMP_FULL = 111,
  DOM_STEP_INFO = 201,
  LINEAR_ACCEL = 202,
  Q9AXIS = 204,
  DOM_DS_LIN_ACC = 230,
  DOM_DS_MCAL = 231,
  DOM_DS_Q = 232,
  PRESSURE = 233,
}

export function logIdToString(id: LogIds) {
  switch (id) {
    case LogIds.DOM_DS_LIN_ACC:
      return "DsLinAcc";
    case LogIds.PRESSURE:
      return "Pressure";
    case LogIds.DOM_STEP_INFO:
      return "DomStepInfo";
    case LogIds.TEMPERATURE:
      return "Temperature";
    case LogIds.TIMESTAMP_FULL:
      return "TimestampFull";
    default:
      return `${id}`;
  }
}

export type OutputLog = DomStepInfoLog | DsLinAccLog | PressureLog | TemperatureLog
  | TimestampFullLog;

export type DomStepInfoLog = {
  id: LogIds.DOM_STEP_INFO;
  ts: number;
  stepNum: number;
  heading: number;
  conf: number;
  stepLength: number;
  values: number[];
}

export type DsLinAccLog = {
  id: LogIds.DOM_DS_LIN_ACC;
} & Sensor3AxisLog;

export type PressureLog = {
  id: LogIds.PRESSURE;
  ts: number;
  hpaValue: number;
  values: number[];
}

export type TemperatureLog = {
  id: LogIds.TEMPERATURE;
  ts: number;
  degrees: number;
  values: number[];
}

export type TimestampFullLog = {
  id: LogIds.TIMESTAMP_FULL;
  ts: number;
  upper: number;
  values: number[];
}

export type Sensor3AxisLog = {
  ts: number;
  x: number;
  y: number;
  z: number;
  values: number[];
}
