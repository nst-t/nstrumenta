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

    // Move our custom controls onto the map.
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
        scaledSize: new google.maps.Size(18, 30), // Original image 12x20
      };
      return icon;
    }
    function makePointIcon(url: string) {
      const icon: google.maps.Icon = {
        url,
        scaledSize: new google.maps.Size(6, 6), // Original image is 12x12
        anchor: new google.maps.Point(3, 3), // Center of the image.
      };
      return icon;
    }

    this.userIcons = {
      start: makeCurrentPosIcon('./icons/markers/mm_20_green.png'),
      currentDom: makeCurrentPosIcon('./icons/markers/mm_20_black.png'),
      currentGps: makeCurrentPosIcon('./icons/markers/mm_20_blue.png'),
      currentDomGpsFusion: makeCurrentPosIcon('./icons/markers/mm_20_purple.png'),
      currentWaypoint: makeCurrentPosIcon('./icons/markers/mm_20_red.png'),
      domPath: makePointIcon('./icons/circles/black-circle-50percentOpacity.png'),
      gpsPath: makePointIcon('./icons/circles/blue-circle-50PercentOpacity.png'),
      domGpsFusionPath: makePointIcon('./icons/circles/purple-circle-50PercentOpacity.png'),
      waypoint: {
        url: './icons/markers/mm_20_red.png',
        scaledSize: new google.maps.Size(12, 20), // Original image 12x20
      },
      currentAr: makeCurrentPosIcon('./icons/markers/mm_20_yellow.png'),
      arPath: makePointIcon('./icons/circles/yellow-circle-50PercentOpacity.png'),
    };

    /**
     * NOTE: This class is nested since 'google' might be undefined elsewhere...
     * The custom USGSOverlay object contains the USGS image,
     * the bounds of the image, and a reference to the map.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class USGSOverlay extends google.maps.OverlayView {
      bounds: google.maps.LatLngBounds;

      image: string;

      div?: HTMLDivElement;

      constructor(boundsInner: google.maps.LatLngBounds, imageInner: string) {
        super();
        this.bounds = boundsInner;
        this.image = imageInner;
      }

      /**
       * onAdd is called when the map's panes are ready and the overlay has been
       * added to the map.
       */
      onAdd() {
        this.div = document.createElement('div');
        this.div.style.borderStyle = 'none';
        this.div.style.borderWidth = '0px';
        this.div.style.position = 'absolute';

        // Create the img element and attach it to the div.
        const img = document.createElement('img');

        img.src = this.image;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.position = 'absolute';
        img.style.opacity = '0.75';
        this.div.appendChild(img);

        // Add the element to the "overlayLayer" pane.
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(this.div);
      }

      draw() {
        // We use the south-west and north-east
        // coordinates of the overlay to peg it to the correct position and size.
        // To do this, we need to retrieve the projection from the overlay.
        const overlayProjection = this.getProjection();
        // Retrieve the south-west and north-east coordinates of this overlay
        // in LatLngs and convert them to pixel coordinates.
        // We'll use these coordinates to resize the div.
        const swPoint = overlayProjection.fromLatLngToDivPixel(this.bounds.getSouthWest());
        const nePoint = overlayProjection.fromLatLngToDivPixel(this.bounds.getNorthEast());

        // Resize the image's div to fit the indicated dimensions.
        if (this.div) {
          this.div.style.left = `${swPoint!.x}px`;
          this.div.style.top = `${nePoint!.y}px`;
          this.div.style.width = `${nePoint!.x - swPoint!.x}px`;
          this.div.style.height = `${swPoint!.y - nePoint!.y}px`;
        }
      }

      /**
       * The onRemove() method will be called automatically from the API if
       * we ever set the overlay's map property to 'null'.
       */
      onRemove() {
        if (this.div) {
          this.div.parentNode!.removeChild(this.div);
          delete this.div;
        }
      }

      /**
       *  Set the visibility to 'hidden' or 'visible'.
       */
      hide() {
        if (this.div) {
          this.div.style.visibility = 'hidden';
        }
      }

      show() {
        if (this.div) {
          this.div.style.visibility = 'visible';
        }
      }

      toggle() {
        if (this.div) {
          if (this.div.style.visibility === 'hidden') {
            this.show();
          } else {
            this.hide();
          }
        }
      }

      toggleDOM(map: google.maps.Map) {
        if (this.getMap()) {
          this.setMap(null);
        } else {
          this.setMap(map);
        }
      }
    }

    const sw = new google.maps.LatLng(32.76208364661284, -117.16949642676634);
    const ne = new google.maps.LatLng(32.762729447635465, -117.16864214981514);
    const bounds = new google.maps.LatLngBounds(sw, ne);

    //doesn't exist?
    // const overlay = new USGSOverlay(bounds, './overlays/SanDiego_Rot105_9.png');
    // overlay.setMap(this.map);

    // // Debug looking at wheree the bounds are placed.
    // const swMarker = new google.maps.Marker({
    //   position: sw,
    //   map: this.map,
    //   draggable: true,
    // });
    // swMarker.addListener('drag', (mouseEvent: google.maps.MapMouseEvent) => {
    //   sw = mouseEvent.latLng!;
    //   bounds = new google.maps.LatLngBounds(
    //     sw,
    //     ne,
    //   );
    //   overlay.bounds = bounds;
    //   overlay.draw();
    // });
    // swMarker.addListener('dragend', () => {
    //   console.log('sw', sw.lat(), ',', ne.lng());
    // });
    // const neMarker = new google.maps.Marker({
    //   position: ne,
    //   map: this.map,
    //   draggable: true,
    // });
    // neMarker.addListener('drag', (mouseEvent: any) => {
    //   ne = mouseEvent.latLng;
    //   bounds = new google.maps.LatLngBounds(
    //     sw,
    //     ne,
    //   );
    //   overlay.bounds = bounds;
    //   overlay.draw();
    // });
    // neMarker.addListener('dragend', () => {
    //   console.log('ne', ne.lat(), ',', ne.lng());
    // });

    // // Debug trying to identify new bound points by clicking on the map.
    // google.maps.event.addListener(this.map, 'click', (event: any) => {
    //   console.log(`${event.latLng.lat()}, ${event.latLng.lng()}`);
    // });

    // This shouldn't be needed since the spinner prevents connecting to nst until the
    // map is loaded, but just ot be safe...
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
