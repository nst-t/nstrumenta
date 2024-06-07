import { NstrumentaBrowserClient } from 'nstrumenta/dist/browser/client';
import { ClientStatus } from 'nstrumenta/dist/shared/lib/client';
import { MapManager } from 'src/app/map/MapManager';

export class NstFusionUtility {
  private nstClient: NstrumentaBrowserClient = new NstrumentaBrowserClient();

  channels: Channels;

  mapManager: MapManager;

  username = 'Placeholder'

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
    this.channels = this.makeChannels(this.username);
  }

  async connectToNst(wsUrl: string, apiKey: string, username: string) {
    // const { nstOpen } = this.state;
    // if (nstOpen) {
    //   console.log('Already connected to nstrumenta server.');
    //   return;
    // }
    // this.setState({ loading: true });

    // Start fresh when connecting/reconnecting.
    if (this.nstClient) {
      this.nstClient.shutdown();
    }
    const nstClient = new NstrumentaBrowserClient();
    this.nstClient = nstClient;

    nstClient.addListener('open', () => {
      // this.setState({ nstOpen: true, loading: false, expanded: false });
      this.username = username;
      this.channels = this.makeChannels(username);
      this.mapManager.addUser(this.username, {
        start: true,
        dom: true,
        gps: true,
        fusion: true,
        ar: true,
        waypoints: true,
      });
      this.mapManager.updateCurrentUser(this.username);

      nstClient.addSubscription(`${Nst.Channels.ON_SETUP}_${username}`, () => {
        nstClient.addSubscription(`${Nst.Channels.FUSION}_${username}`, (msg: Nst.Output) => {
          if (this.mapManager) {
            this.mapManager.updateFused(username, msg.steps);
          }
        });
        nstClient.addSubscription(`${Nst.Channels.FUSION_END}_${username}`, (msg: Nst.Output) => {
          if (this.mapManager) {
            this.mapManager.updateFused(username, msg.steps);
          }
        });
      });
      nstClient.addSubscription(`${Nst.Channels.ERROR}_${username}`, (msg: Nst.ErrorMsg) => {
        console.error(msg);
      });

      const setupMsg: Nst.Setup = { id: username, liveUpdate: true, trimPrecision: true };
      nstClient.send(Nst.Channels.SETUP, setupMsg);
    });

    this.nstClient.addListener('close', () => {
      // const { nstOpen: nstOpenInner } = this.state;
      console.log('Nstrumenta connection closed.');

      // if (!this.didDisconnect) {
      //   let msg: string;
      //   if (nstOpenInner) {
      //     msg = 'Disconnected from Nstrumenta server.';
      //     this.didDisconnect = true;
      //   } else {
      //     msg = 'Could not connect to Nstrumenta server.';
      //   }
      //   console.error(msg);
      //   this.openErrorModal(msg);

      //   if (nstOpenInner) {
      //     this.setState({ nstOpen: false });
      //   } else {
      //     const { loading } = this.state;
      //     if (loading) {
      //       this.setState({ loading: false });
      //     }
      //   }
      // }
      // this.setState({ expanded: true });
    });

    console.log('Connecting to nstrumenta server.');
    try {
      // this.didDisconnect = false;
      await this.nstClient.connect({ wsUrl, apiKey });
    } catch (ex) {
      console.error('Could not connect to Nstrumenta server.', ex);
      // this.setState({ loading: false });
      // this.openErrorModal(`Could not connect to Nstrumenta server: ${ex}`);
    }
  }

  startWalkEvt(msg: Nst.StartDom) {
    this.mapManager.addStart(this.username, msg.lat, msg.lon);
    this.mapManager.walkStarted = true;
    this.nstClient.send(this.channels.startWalk, msg);
  }

  domEvt(msg: Nst.Dom) {
    // this.mapManager.addDom(pt.lat, pt.lon); // TODO: Add code to turn heading/sl to lat/lon.
    this.nstClient.send(this.channels.dom, msg);
  }

  gspEvt(msg: Nst.Gps) {
    this.mapManager.addGps(this.username, msg.lat, msg.lon);
    this.nstClient.send(this.channels.gps, msg);
  }

  dsEvt(msg: Nst.Ds) {
    this.nstClient.send(this.channels.ds, msg);
  }

  pressureEvt(msg: Nst.Pressure) {
    this.nstClient.send(this.channels.pressure, msg);
  }

  temperatureEvt(msg: Nst.Temperature) {
    this.nstClient.send(this.channels.temperature, msg);
  }

  waypointEvt(msg: Nst.Waypoint) {
    this.mapManager.addWaypoint(this.username, msg.lat, msg.lon);
    this.nstClient.send(this.channels.waypoint, msg);
  }

  stopWalkEvt() {
    this.nstClient.send(this.channels.stopWalk, {});
  }

  private makeChannels(username: string): Channels {
    return {
      startWalk: `${Nst.Channels.START_WALK}_${username}`,
      gps: `${Nst.Channels.GPS}_${username}`,
      dom: `${Nst.Channels.DOM}_${username}`,
      ds: `${Nst.Channels.DS}_${username}`,
      waypoint: `${Nst.Channels.WAYPOINT}_${username}`,
      pressure: `${Nst.Channels.PRESSURE}_${username}`,
      temperature: `${Nst.Channels.TEMPERATURE}_${username}`,
      stopWalk: `${Nst.Channels.STOP_WALK}_${username}`,
    };
  }
}

type Channels = {
  startWalk: string;
  gps: string;
  dom: string;
  waypoint: string;
  ds: string;
  pressure: string;
  temperature: string;
  stopWalk: string;
}

namespace Nst {
  export const enum Channels {
    SETUP = 'SETUP',
    REMOVE = 'REMOVE',
    ON_SETUP = 'ON_SETUP',
    ON_REMOVE = 'ON_REMOVE',

    START_WALK = 'START_WALK',
    STOP_WALK = 'STOP_WALK',
    DOM = 'DOM',
    GPS = 'GPS',
    WAYPOINT = 'WAYPOINT',
    DS = 'DS',
    PRESSURE = 'PRESSURE',
    TEMPERATURE = 'TEMPERATURE',

    FUSION = 'FUSION',
    FUSION_END = 'FUSION_END',
    ERROR = 'ERROR',
  }

  export type Setup = {
    id: string;
    liveUpdate: boolean;
    newStepsOnly?: boolean;
    trimPrecision: boolean;
  }

  export declare type StartDom = {
    /** Unwrapped timestamp in seconds. */
    ts: number;
    lat: number;
    lon: number;
    posAcc: number;
    alt: number;
    altAcc: number;
    decl: number;
    ls: 'gps' | 'manual';

    /**
     * To limit traffic, the client can send a bool on the start object
     * to indicate if remote fusion is indented. If false is sent,
     * then all fusion input will be ignored until the next start object.
     * */
    remote?: boolean;
  };

  export declare type Gps = {
    /** Unwrapped timestamp in seconds. */
    ts: number;
    lat: number;
    lon: number;
    posAcc: number;
    alt: number;
    altAcc: number;
  };

  export declare type Dom = {
    /** Unwrapped timestamp in seconds. */
    ts: number;
    heading: number;
    temp: number;
    stepNum: number;
    length: number;
    conf: number;
  };

  export declare type Waypoint = {
    /** Unwrapped timestamp in seconds. */
    ts: number;
    lat: number;
    lon: number;
  };

  export declare type Ds = {
    /** Unwrapped timestamp in seconds. */
    ts: number;
    x: number;
    y: number;
    z: number;
  };

  export type Pressure = {
    ts: number;
    value: number;
  }

  export type Temperature = {
    // ts: number;
    value: number;
  }

  export type UserOptions = {
    liveUpdate: boolean;
  }

  export declare type Result = {
    ts: number;
    lat: number;
    lon: number;
    heading: number;
    temp: number;
    stepNum: number;
    length: number;
    conf: number;
    refUnc: number;
    type: number;
    alt: number;
    relAlt: number;
    i: number;
  };

  export type Output = {
    steps: Result[];
  }

  export type ErrorMsg = {
    msg: string;
    obj?: Error | object | string | unknown;
  }
}