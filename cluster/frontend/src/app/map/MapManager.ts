/* eslint-disable max-classes-per-file */
import { Loader } from '@googlemaps/js-api-loader';
import { UserIcons, MapUser, Visible } from './MapUser';

interface MapCtrFields {
  map: HTMLElement;
  apiKey: string;
  shownPaths: HTMLElement | null;
  trackPath: HTMLElement | null;
  onMapClick: (lat: number, lon: number) => void;
  visible: Visible;
}

export const enum TrackingMode {
  none = 'none',
  gps = 'gps',
  dom = 'dom',
  fusion = 'fusion',
  ar = 'ar',
}

type MapMarker = {
  label: string | google.maps.MarkerLabel;
  icon: google.maps.Icon | google.maps.Symbol;
};

type MapMarkers = {
  remoteManualStart: MapMarker;
  remoteWaypoint: MapMarker;
};

export class MapManager {
  map: google.maps.Map | null = null;

  pendingUserIds = new Map<string, string>();

  users = new Map<string, MapUser>();

  private currentUserId = '';

  userIcons: UserIcons | null = null;

  mapMarkers: MapMarkers | null = null;

  trackingMode: string = TrackingMode.none;

  manualStartMarker: google.maps.Marker | null = null;

  walkStarted = false;

  waypoints = false;

  firstWalk = true;

  async load(fields: MapCtrFields) {
    if (this.map) {
      return;
    }

    const loader = new Loader({
      apiKey: fields.apiKey,
      version: 'quarterly',
    });
    const google = await loader.load();

    this.map = new google.maps.Map(fields.map, {
      center: { lat: 38.421, lng: -122.7553 },
      zoom: 18,
      clickableIcons: false,
      scaleControl: true,
      fullscreenControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      streetViewControl: false,
      rotateControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM },
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
      },
      styles: [
        {
          featureType: 'poi',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'transit',
          elementType: 'labels.icon',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'road',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    if (fields.shownPaths) {
      this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(fields.shownPaths);
    }
    if (fields.trackPath) {
      this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(fields.trackPath);
    }

    const makeMapMarker = (color: string, labelText: string): MapMarker => ({
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8.5,
        fillColor: color,
        fillOpacity: 0.4,
        strokeWeight: 0.4,
        labelOrigin: new google.maps.Point(0, 2),
      },
      label: {
        text: labelText,
        color: '#000',
        fontSize: '14px',
        fontWeight: 'bold',
      },
    });

    this.mapMarkers = {
      remoteManualStart: makeMapMarker('green', 'Remote Manual Start'),
      remoteWaypoint: makeMapMarker('red', 'Remote Waypoint'),
    };

    this.map.addListener('click', (evt: google.maps.MapMouseEvent) => {
      console.log(`map click ${evt.latLng}}`);
      if (this.currentUserId && (!this.walkStarted || this.waypoints)) {
        let label: string | google.maps.MarkerLabel;
        let icon: google.maps.Icon | google.maps.Symbol;
        if (!this.walkStarted) {
          label = this.mapMarkers!.remoteManualStart.label;
          icon = this.mapMarkers!.remoteManualStart.icon;
        } else {
          label = this.mapMarkers!.remoteWaypoint.label;
          icon = this.mapMarkers!.remoteWaypoint.icon;
        }

        if (!this.manualStartMarker) {
          this.manualStartMarker = new google.maps.Marker({
            position: evt.latLng,
            map: this.map,
            clickable: false,
            icon,
            label,
          });
        } else {
          this.manualStartMarker.setPosition(evt.latLng);
          this.manualStartMarker.setIcon(icon);
          this.manualStartMarker.setLabel(label);
        }
        fields.onMapClick(evt.latLng!.lat(), evt.latLng!.lng());
      }
    });

    function makeCurrentPosIcon(url: string) {
      const icon: google.maps.Icon = {
        url,
        scaledSize: new google.maps.Size(18, 30),
      };
      return icon;
    }
    function makePointIcon(url: string) {
      const icon: google.maps.Icon = {
        url,
        scaledSize: new google.maps.Size(6, 6),
        anchor: new google.maps.Point(3, 3),
      };
      return icon;
    }

    this.userIcons = {
      start: makeCurrentPosIcon('../../assets/icons/markers/mm_20_green.png'),
      currentDom: makeCurrentPosIcon('../../assets/icons/markers/mm_20_black.png'),
      currentGps: makeCurrentPosIcon('../../assets/icons/markers/mm_20_blue.png'),
      currentDomGpsFusion: makeCurrentPosIcon('../../assets/icons/markers/mm_20_purple.png'),
      currentWaypoint: makeCurrentPosIcon('../../assets/icons/markers/mm_20_red.png'),
      domPath: makePointIcon('../../assets/icons/circles/black-circle-50percentOpacity.png'),
      gpsPath: makePointIcon('../../assets/icons/circles/blue-circle-50PercentOpacity.png'),
      domGpsFusionPath: makePointIcon('../../assets/icons/circles/purple-circle-50PercentOpacity.png'),
      waypoint: {
        url: '../../assets/icons/markers/mm_20_red.png',
        scaledSize: new google.maps.Size(12, 20), // Original image 12x20
      },
      currentAr: makeCurrentPosIcon('../../assets/icons/markers/mm_20_yellow.png'),
      arPath: makePointIcon('../../assets/icons/circles/yellow-circle-50PercentOpacity.png'),
    };

    this.pendingUserIds.forEach((id) => {
      this.users.set(
        id,
        new MapUser(this.map!, id, id === this.currentUserId, this.userIcons!, fields.visible)
      );
    });
    this.pendingUserIds.clear();
  }

  addUser(id: string, visible: Visible) {
    if (!this.map || !this.userIcons) {
      this.pendingUserIds.set(id, id);
    } else if (!this.users.has(id)) {
      this.users.set(
        id,
        new MapUser(this.map, id, id === this.currentUserId, this.userIcons, visible)
      );
    }
  }

  getCurrentUserId() {
    return this.currentUserId;
  }

  updateCurrentUser(id: string) {
    this.currentUserId = id;
    this.users.forEach((user) => user.setActiveUser(user.id === id));
  }

  addStart(id: string, lat: number, lon: number) {
    const user = this.users.get(id);
    if (user) {
      const latLng = new google.maps.LatLng(lat, lon);
      user.addStart(latLng);

      if (this.firstWalk) {
        this.firstWalk = false;
        this.map?.setCenter(latLng);
        this.map?.setZoom(19);
      }
    }
  }

  addGps(id: string, lat: number, lon: number) {
    const user = this.users.get(id);
    if (user) {
      const latLng = new google.maps.LatLng(lat, lon);
      user.addGps(latLng);

      if (this.trackingMode === TrackingMode.gps && id === this.currentUserId) {
        this.map!.setCenter(latLng);
      }
    }
  }

  addDom(id: string, lat: number, lon: number) {
    const user = this.users.get(id);
    if (user) {
      const latLng = new google.maps.LatLng(lat, lon);
      user.addDom(latLng);

      if (this.trackingMode === TrackingMode.dom && id === this.currentUserId) {
        this.map!.setCenter(latLng);
      }
    }
  }

  updateFused(id: string, values: { lat: number; lon: number; i: number }[]) {
    const user = this.users.get(id);
    if (user) {
      const latLng = user.updateFused(values);
      if (latLng && this.trackingMode === TrackingMode.fusion && id === this.currentUserId) {
        this.map!.setCenter(latLng);
      }
    }
  }

  addAr(id: string, lat: number, lon: number) {
    const user = this.users.get(id);
    if (user) {
      const latLng = new google.maps.LatLng(lat, lon);
      user.addAr(latLng);

      if (this.trackingMode === TrackingMode.ar && id === this.currentUserId) {
        this.map!.setCenter(latLng);
      }
    }
  }

  addWaypoint(id: string, lat: number, lon: number) {
    const user = this.users.get(id);
    if (user) {
      const latLng = new google.maps.LatLng(lat, lon);
      user.addWaypoint(latLng);
    }
  }

  updateVisibility(id: string, visible: Visible) {
    const user = this.users.get(id);
    if (user) {
      user.updateVisibility(visible);
    }
  }

  setCurrentStartVisible(isVisible: boolean) {
    const user = this.users.get(this.currentUserId);
    if (user) {
      user.setStartMarkerVisible(isVisible);
    }
  }

  setCurrentDomPathVisible(isVisible: boolean) {
    const user = this.users.get(this.currentUserId);
    if (user) {
      user.setDomPathVisible(isVisible);
    }
  }

  setCurrentGpsPathVisible(isVisible: boolean) {
    const user = this.users.get(this.currentUserId);
    if (user) {
      user.setGpsPathVisible(isVisible);
    }
  }

  setCurrentFusionPathVisible(isVisible: boolean) {
    const user = this.users.get(this.currentUserId);
    if (user) {
      user.setFusionPathVisible(isVisible);
    }
  }

  setCurrentArPathVisible(isVisible: boolean) {
    const user = this.users.get(this.currentUserId);
    if (user) {
      user.setArPathVisible(isVisible);
    }
  }

  setCurrentWaypointsVisible(isVisible: boolean) {
    const user = this.users.get(this.currentUserId);
    if (user) {
      user.setWaypointMarkersVisible(isVisible);
    }
  }

  updateTracking(newMode: string) {
    this.trackingMode = newMode;
    const user = this.users.get(this.currentUserId);
    if (!this.map || !user) {
      return;
    }

    switch (this.trackingMode) {
      case TrackingMode.dom:
        if (user.dom.current) {
          this.map.setCenter(user.dom.current);
        }
        break;
      case TrackingMode.gps:
        if (user.gps.current) {
          this.map.setCenter(user.gps.current);
        }
        break;
      case TrackingMode.ar:
        if (user.ar.current) {
          this.map.setCenter(user.ar.current);
        }
        break;
      case TrackingMode.fusion:
        if (user.fusion.current) {
          this.map.setCenter(user.fusion.current);
        }
        break;
      default:
        break;
    }
  }

  clearAllMarkersAndLines(id: string) {
    const user = this.users.get(id);
    if (user) {
      user.clearAllMarkersAndLines();
    }
  }
}
