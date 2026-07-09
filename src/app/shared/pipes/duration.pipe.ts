import { Pipe, PipeTransform } from '@angular/core';
import { formatDuration } from '../../domain/utils/distance.util';

@Pipe({ name: 'duration', standalone: false })
export class DurationPipe implements PipeTransform {
  transform(seconds?: number | null): string {
    return formatDuration(seconds);
  }
}
