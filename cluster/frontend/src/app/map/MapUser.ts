interface Start {
  marker: google.maps.Marker | null;
  visible: boolean;
}

interface Waypoint {
  markers: google.maps.Marker[];
  visible: boolean;
}

interface Path {
  polyline: google.maps.Polyline;
  currentMarker: google.maps.Marker | null;
  pathMarkers: google.maps.Marker[];
  visible: boolean;
  current: google.maps.LatLng | null;
}

export interface UserIcons {
  start: google.maps.Icon;
  currentDom: google.maps.Icon;
  currentGps: google.maps.Icon;
  currentDomGpsFusion: google.maps.Icon;
  currentWaypoint: google.maps.Icon;
  domPath: google.maps.Icon;
  gpsPath: google.maps.Icon;
  domGpsFusionPath: google.maps.Icon;
  waypoint: google.maps.Icon;
  currentAr: google.maps.Icon;
  arPath: google.maps.Icon;
}

export type Visible = {
  start: boolean;
  gps: boolean;
  dom: boolean;
  fusion: boolean;
  ar: boolean;
  waypoints: boolean;
}

type Option = {
  zIdx: {
    marker: number;
    path: number;
    poly: number;
  }
  opac: {
    marker: number;
    poly: number;
  }
}

export class MapUser {
  map: google.maps.Map;

  id: string;

  start: Start;

  gps: Path;

  dom: Path;

  fusion: Path;

  ar: Path;

  waypoints: Waypoint;

  icons: UserIcons;

  isActive: boolean;

  static readonly options: { active: Option, inactive: Option } = {
    active: {
      zIdx: { marker: 2000, path: 1900, poly: 1800 },
      opac: { marker: 1, poly: 0.5 },
    },
    inactive: {
      zIdx: { marker: 1000, path: 900, poly: 800 },
      opac: { marker: 0.5, poly: 0.3 },
    },
  };

  constructor(
    map: google.maps.Map,
    id: string,
    isActive: boolean,
    icons: UserIcons,
    visible: Visible,
  ) {
    this.map = map;
    this.id = id;
    this.isActive = isActive;
    this.icons = icons;
    this.start = { marker: null, visible: visible.start };
    this.gps = {
      polyline: MapUser.makePolyline('blue', map, isActive),
      currentMarker: null,
      pathMarkers: [],
      visible: true,
      current: null,
    };
    this.dom = {
      polyline: MapUser.makePolyline('black', map, isActive),
      currentMarker: null,
      pathMarkers: [],
      visible: true,
      current: null,
    };
    this.fusion = {
      polyline: MapUser.makePolyline('purple', map, isActive),
      currentMarker: null,
      pathMarkers: [],
      visible: true,
      current: null,
    };
    this.ar = {
      polyline: MapUser.makePolyline('yellow', map, isActive),
      currentMarker: null,
      pathMarkers: [],
      visible: true,
      current: null,
    };
    this.waypoints = { markers: [], visible: visible.waypoints };

    this.setDomPathVisible(visible.dom);
    this.setGpsPathVisible(visible.gps);
    this.setFusionPathVisible(visible.fusion);
    this.setArPathVisible(visible.ar);
  }

  addStart(latLng: google.maps.LatLng) {
    this.clearAllMarkersAndLines();
    if (!this.start.marker) {
      const options = (this.isActive) ? MapUser.options.active : MapUser.options.inactive;
      const title = `Start (${this.id})`;
      this.start.marker = new google.maps.Marker({
        position: latLng,
        map: this.map,
        icon: this.icons.start,
        title,
        clickable: true,
        visible: this.start.visible,
        zIndex: options.zIdx.marker,
        opacity: options.opac.marker,
      });

      this.setMouseOverInfoWindow(this.start.marker, title);
    } else {
      this.start.marker.setPosition(latLng);
    }

    this.gps.polyline.getPath().push(latLng);
    this.dom.polyline.getPath().push(latLng);
    this.ar.polyline.getPath().push(latLng);

    this.gps.current = latLng;
    this.dom.current = latLng;
    this.fusion.current = latLng;
    this.ar.current = latLng;
  }

  addGps(latLng: google.maps.LatLng) {
    const options = (this.isActive) ? MapUser.options.active : MapUser.options.inactive;
    if (!this.gps.currentMarker) {
      const title = `GPS (${this.id})`;
      this.gps.currentMarker = new google.maps.Marker({
        position: latLng,
        map: this.map,
        icon: this.icons.currentGps,
        title,
        clickable: true,
        visible: this.gps.visible,
        zIndex: options.zIdx.marker,
        opacity: options.opac.marker,
      });
      this.setMouseOverInfoWindow(this.gps.currentMarker, title);
    } else {
      this.gps.currentMarker.setPosition(latLng);
    }
    this.gps.polyline.getPath().push(latLng);

    const marker = new google.maps.Marker({
      position: latLng,
      map: this.map,
      icon: this.icons.gpsPath,
      clickable: false,
      visible: this.gps.visible,
      zIndex: options.zIdx.path,
      opacity: options.opac.marker,
    });
    this.gps.pathMarkers.push(marker);

    this.gps.current = latLng;
  }

  addDom(latLng: google.maps.LatLng) {
    const options = (this.isActive) ? MapUser.options.active : MapUser.options.inactive;
    if (!this.dom.currentMarker) {
      const title = `DOM (${this.id})`;
      this.dom.currentMarker = new google.maps.Marker({
        position: latLng,
        map: this.map,
        icon: this.icons.currentDom,
        title,
        clickable: true,
        visible: this.dom.visible,
        zIndex: options.zIdx.marker,
        opacity: options.opac.marker,
      });
      this.setMouseOverInfoWindow(this.dom.currentMarker, title);
    } else {
      this.dom.currentMarker.setPosition(latLng);
    }
    this.dom.polyline.getPath().push(latLng);

    const marker = new google.maps.Marker({
      position: latLng,
      map: this.map,
      icon: this.icons.domPath,
      clickable: false,
      visible: this.dom.visible,
      zIndex: options.zIdx.path,
      opacity: options.opac.marker,
    });
    this.dom.pathMarkers.push(marker);

    this.dom.current = latLng;
  }

  updateFused(values: { lat: number, lon: number, i: number }[]): google.maps.LatLng | null {
    if (!values.length) { return null; }
    const path = this.fusion.polyline.getPath();
    const length = path.getLength();

    let latLng: google.maps.LatLng | null = null;
    const options = (this.isActive) ? MapUser.options.active : MapUser.options.inactive;

    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      latLng = new google.maps.LatLng(value.lat, value.lon);

      if (value.i < length) {
        // Old points were adjusted.
        path.setAt(value.i, latLng);
        this.fusion.pathMarkers[value.i].setPosition(latLng);
      } else {
        path.push(latLng);
        const marker = new google.maps.Marker({
          position: latLng,
          map: this.map,
          icon: this.icons.domGpsFusionPath,
          clickable: false,
          visible: this.fusion.visible,
          zIndex: options.zIdx.path,
          opacity: options.opac.marker,
        });
        this.fusion.pathMarkers.push(marker);
      }
    }

    if (latLng) {
      this.fusion.current = latLng;

      if (!this.fusion.currentMarker) {
        const title = `Fusion (${this.id})`;
        this.fusion.currentMarker = new google.maps.Marker({
          position: latLng,
          map: this.map,
          icon: this.icons.currentDomGpsFusion,
          title,
          clickable: true,
          visible: this.fusion.visible,
          zIndex: options.zIdx.marker,
          opacity: options.opac.marker,
        });
        this.setMouseOverInfoWindow(this.fusion.currentMarker, title);
      } else {
        this.fusion.currentMarker.setPosition(latLng);
      }
    }
    return latLng;
  }

  addAr(latLng: google.maps.LatLng) {
    const options = (this.isActive) ? MapUser.options.active : MapUser.options.inactive;
    if (!this.ar.currentMarker) {
      const title = `AR (${this.id})`;
      this.ar.currentMarker = new google.maps.Marker({
        position: latLng,
        map: this.map,
        icon: this.icons.currentAr,
        title,
        clickable: true,
        visible: this.ar.visible,
        zIndex: options.zIdx.marker,
        opacity: options.opac.marker,
      });
      this.setMouseOverInfoWindow(this.ar.currentMarker, title);
    } else {
      this.ar.currentMarker.setPosition(latLng);
    }
    this.ar.polyline.getPath().push(latLng);

    const marker = new google.maps.Marker({
      position: latLng,
      map: this.map,
      icon: this.icons.arPath,
      clickable: false,
      visible: this.ar.visible,
      zIndex: options.zIdx.path,
      opacity: options.opac.marker,
    });
    this.ar.pathMarkers.push(marker);

    this.ar.current = latLng;
  }

  addWaypoint(latLng: google.maps.LatLng) {
    const options = (this.isActive) ? MapUser.options.active : MapUser.options.inactive;
    const title = `Waypoint ${this.waypoints.markers.length + 1} (${this.id})`;
    const marker = new google.maps.Marker({
      position: latLng,
      map: this.map,
      icon: this.icons.waypoint,
      title,
      clickable: true,
      visible: true,
      zIndex: options.zIdx.marker,
      opacity: options.opac.marker,
    });
    this.setMouseOverInfoWindow(marker, title);
    this.waypoints.markers.push(marker);
  }

  clearAllMarkersAndLines() {
    // Remove old start marker.
    if (this.start.marker) {
      this.start.marker.setMap(null);
      this.start.marker = null;
    }

    // Remove old dom path polyline and markers.
    this.dom.polyline.getPath().clear();
    if (this.dom.currentMarker) {
      this.dom.currentMarker.setMap(null);
      this.dom.currentMarker = null;
    }
    while (this.dom.pathMarkers.length > 0) {
      const marker = this.dom.pathMarkers.pop();
      marker!.setMap(null);
    }

    // Remove old gps path polyline and markers.
    this.gps.polyline.getPath().clear();
    if (this.gps.currentMarker) {
      this.gps.currentMarker.setMap(null);
      this.gps.currentMarker = null;
    }
    while (this.gps.pathMarkers.length > 0) {
      const marker = this.gps.pathMarkers.pop();
      marker!.setMap(null);
    }

    // Remove old dom-gps fusion path polyline and markers.
    this.fusion.polyline.getPath().clear();
    if (this.fusion.currentMarker) {
      this.fusion.currentMarker.setMap(null);
      this.fusion.currentMarker = null;
    }
    while (this.fusion.pathMarkers.length > 0) {
      const marker = this.fusion.pathMarkers.pop();
      marker!.setMap(null);
    }

    while (this.waypoints.markers.length > 0) {
      const marker = this.waypoints.markers.pop();
      marker!.setMap(null);
    }

    this.ar.polyline.getPath().clear();
    if (this.ar.currentMarker) {
      this.ar.currentMarker.setMap(null);
      this.ar.currentMarker = null;
    }
    while (this.ar.pathMarkers.length > 0) {
      const marker = this.ar.pathMarkers.pop();
      marker!.setMap(null);
    }
  }

  setActiveUser(value: boolean) {
    this.isActive = value;
    const options = (value) ? MapUser.options.active : MapUser.options.inactive;
    if (this.start.marker) {
      this.start.marker.setOptions({
        opacity: options.opac.marker,
        zIndex: options.zIdx.marker,
      });
    }
    [this.gps, this.dom, this.fusion, this.ar].forEach((path) => {
      path.polyline.setOptions({ strokeOpacity: options.opac.poly, zIndex: options.zIdx.poly });
      if (path.currentMarker) {
        path.currentMarker.setOptions({
          opacity: options.opac.marker,
          zIndex: options.zIdx.marker,
        });
      }
      path.pathMarkers.forEach((marker) => marker.setOptions({
        opacity: options.opac.marker,
        zIndex: options.zIdx.path,
      }));
    });
    this.waypoints.markers.forEach((marker) => marker.setOptions({
      opacity: options.opac.marker,
      zIndex: options.zIdx.marker,
    }));
  }

  updateVisibility(visible: Visible) {
    this.setStartMarkerVisible(visible.start);
    this.setDomPathVisible(visible.dom);
    this.setGpsPathVisible(visible.gps);
    this.setFusionPathVisible(visible.fusion);
    this.setArPathVisible(visible.ar);
    this.setWaypointMarkersVisible(visible.waypoints);
  }

  setStartMarkerVisible(isVisible: boolean) {
    this.start.visible = isVisible;
    if (this.start.marker) {
      this.start.marker.setVisible(isVisible);
    }
  }

  setDomPathVisible(isVisible: boolean) {
    this.dom.polyline.setVisible(isVisible);
    this.dom.visible = isVisible;
    this.dom.pathMarkers.forEach((marker) => marker.setVisible(isVisible));
    this.dom.currentMarker?.setVisible(isVisible);
  }

  setGpsPathVisible(isVisible: boolean) {
    this.gps.polyline.setVisible(isVisible);
    this.gps.visible = isVisible;
    this.gps.pathMarkers.forEach((marker) => marker.setVisible(isVisible));
    this.gps.currentMarker?.setVisible(isVisible);
  }

  setFusionPathVisible(isVisible: boolean) {
    this.fusion.polyline.setVisible(isVisible);
    this.fusion.visible = isVisible;
    this.fusion.pathMarkers.forEach((marker) => marker.setVisible(isVisible));
    this.fusion.currentMarker?.setVisible(isVisible);
  }

  setArPathVisible(isVisible: boolean) {
    this.ar.polyline.setVisible(isVisible);
    this.ar.visible = isVisible;
    this.ar.pathMarkers.forEach((marker) => marker.setVisible(isVisible));
    this.ar.currentMarker?.setVisible(isVisible);
  }

  setWaypointMarkersVisible(isVisible: boolean) {
    this.waypoints.visible = isVisible;
    this.waypoints.markers.forEach((marker) => marker.setVisible(isVisible));
  }

  static makePolyline(color: string, map: google.maps.Map, isActive: boolean) {
    const options = (isActive) ? this.options.active : this.options.inactive;
    return new google.maps.Polyline({
      map,
      strokeColor: color,
      strokeOpacity: options.opac.poly,
      zIndex: options.zIdx.poly,
      strokeWeight: 2,
      clickable: false,
    });
  }

  setMouseOverInfoWindow(marker: google.maps.Marker, text: string) {
    const infoWindow = new google.maps.InfoWindow({
      content: text,
    });
    marker.addListener('click', () => {
      infoWindow.open(this.map, marker);
    });

    // marker.addListener('mouseover', () => {
    //   infoWindow.open(this.map, marker);
    // });

    // // assuming you also want to hide the infowindow when user mouses-out
    // marker.addListener('mouseout', () => {
    //   infoWindow.close();
    // });
  }
}
