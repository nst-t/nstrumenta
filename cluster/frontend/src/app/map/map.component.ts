import { Component, ElementRef, ViewChild } from '@angular/core';
import { MapManager } from './MapManager';
import { environment } from 'src/environments/environment';
import { GoogleMap } from '@angular/google-maps'; // Adjust the import path as needed

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent {
  @ViewChild('map', { static: false }) map: ElementRef;
  @ViewChild('shownPaths', { static: false }) shownPaths: ElementRef;
  @ViewChild('trackPath', { static: false }) trackPath: ElementRef;
  mapManager: MapManager;

  constructor() {
    this.mapManager = new MapManager();
  }

  ngAfterViewInit(): void {
    this.mapManager
      .load({
        map: this.map.nativeElement,
        apiKey: environment.firebase.apiKey,
        shownPaths: this.shownPaths.nativeElement,
        trackPath: this.trackPath.nativeElement,
        visible: {
          start: true,
          dom: true,
          gps: true,
          fusion: true,
          ar: true,
          waypoints: true,
        },
        onMapClick: (lat, lon) => {
          // const { isNstConnected, walkStarted, currentUserId } = this.state;
          // if (isNstConnected && walkStarted && currentUserId) {
          //   const userData = this.users.get(currentUserId);
          //   if (userData) {
          //     const msg: Nst.ConsumerWaypoint = { lat, lon };
          //     this.nstClient.send(userData.channels.CONSUMER_WAYPOINT, msg);
          //   }
          // }
          console.log(`consumerWaypoint ${lat},${lon}`);
        },
      })
      .then(() => {
        console.log('Google maps loaded!');
        // this.setState({ loading: false });
      })
      .catch((ex) => {
        console.error('Failed to Load Google Maps', ex);
        let errMsg = 'Failed to Load Google Maps';
        if (ex) {
          errMsg += `: ${ex}`;
        }
        console.error(errMsg);
        // this.openErrorModal(errMsg);
        // this.setState({ loading: false });
      });
  }
}
