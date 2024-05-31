import { Component } from '@angular/core';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent {
  center: google.maps.LatLngLiteral;
  zoom = 12;

  constructor() { }

  ngOnInit(): void {
    this.center = { lat: 40.73061, lng: -73.935242 }; // Example coordinates (New York City)
  }
}
