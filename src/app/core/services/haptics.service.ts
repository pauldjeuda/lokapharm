import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Injectable({ providedIn: 'root' })
export class HapticsService {
  async impactLight(): Promise<void> {
    await this.run(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  async notifySuccess(): Promise<void> {
    await this.run(() => Haptics.notification({ type: NotificationType.Success }));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      // Haptics are unavailable in a browser or on unsupported devices.
    }
  }
}
