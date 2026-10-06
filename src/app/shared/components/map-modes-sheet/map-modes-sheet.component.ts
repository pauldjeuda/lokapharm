import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  MAP_MODE_OPTIONS,
  MapModeOption,
  MapViewMode,
  MapViewSettings,
} from '../../../core/models/map-view.model';

@Component({
  selector: 'app-map-modes-sheet',
  templateUrl: './map-modes-sheet.component.html',
  styleUrls: ['./map-modes-sheet.component.scss'],
  standalone: false,
})
export class MapModesSheetComponent {
  @Input() isOpen = false;
  @Input() settings: MapViewSettings = { mode: 'explore', traffic: false, labels: true };

  @Output() closed = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<MapViewMode>();
  @Output() trafficChange = new EventEmitter<boolean>();
  @Output() labelsChange = new EventEmitter<boolean>();

  readonly modes: MapModeOption[] = MAP_MODE_OPTIONS;

  close(): void {
    this.closed.emit();
  }

  selectMode(mode: MapViewMode): void {
    this.modeChange.emit(mode);
  }

  onTrafficToggle(event: CustomEvent): void {
    this.trafficChange.emit(!!event.detail.checked);
  }

  onLabelsToggle(event: CustomEvent): void {
    this.labelsChange.emit(!!event.detail.checked);
  }

  isSelected(mode: MapViewMode): boolean {
    return this.settings.mode === mode;
  }
}
