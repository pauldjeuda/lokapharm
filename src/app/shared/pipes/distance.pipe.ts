import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance } from '../../domain/utils/distance.util';

@Pipe({ name: 'distance', standalone: false })
export class DistancePipe implements PipeTransform {
  transform(meters?: number | null): string {
    return formatDistance(meters);
  }
}
