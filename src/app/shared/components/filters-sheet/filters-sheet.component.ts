import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

export interface MapFiltersState {
  onCall: boolean;
  open24h: boolean;
  maxDistanceKm: number | null;
  sortBy: 'distance' | 'name' | 'status';
}

@Component({
  selector: 'app-filters-sheet',
  templateUrl: './filters-sheet.component.html',
  styleUrls: ['./filters-sheet.component.scss'],
  standalone: false,
})
export class FiltersSheetComponent implements OnChanges {
  @Input() open = false;
  @Input() value: MapFiltersState = {
    onCall: false,
    open24h: false,
    maxDistanceKm: 5,
    sortBy: 'distance',
  };

  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<MapFiltersState>();

  draft: MapFiltersState = { ...this.value };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['open']) {
      this.draft = { ...this.value };
    }
  }

  setDistance(km: number | null): void {
    this.draft = { ...this.draft, maxDistanceKm: km };
  }

  setSort(sortBy: MapFiltersState['sortBy']): void {
    this.draft = { ...this.draft, sortBy };
  }

  toggleOnCall(): void {
    this.draft = { ...this.draft, onCall: !this.draft.onCall };
  }

  toggle24h(): void {
    this.draft = { ...this.draft, open24h: !this.draft.open24h };
  }

  reset(): void {
    this.draft = { onCall: false, open24h: false, maxDistanceKm: null, sortBy: 'distance' };
  }

  apply(): void {
    this.applied.emit({ ...this.draft });
    this.closed.emit();
  }
}
