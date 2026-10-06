import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CacheService } from '../../core/services/cache.service';
import { firstValueFrom } from 'rxjs';

const ONBOARDING_KEY = 'Lokapharm_onboarding_done_v1';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage {
  index = 0;

  readonly slides = [
    {
      title: 'Trouvez une pharmacie de garde en un instant',
      text: 'Accédez rapidement à la liste des pharmacies ouvertes près de chez vous, de jour comme de nuit.',
    },
    {
      title: 'Itinéraire optimisé',
      text: 'Laissez-vous guider avec le chemin le plus rapide vers la pharmacie sélectionnée.',
    },
    {
      title: 'Appelez directement',
      text: 'Vérifiez la disponibilité de vos médicaments d’un simple clic avant de vous déplacer.',
    },
  ];

  constructor(
    private readonly router: Router,
    private readonly cache: CacheService
  ) {}

  get isLast(): boolean {
    return this.index >= this.slides.length - 1;
  }

  next(): void {
    if (this.isLast) {
      void this.finish();
      return;
    }
    this.index += 1;
  }

  skip(): void {
    void this.finish();
  }

  private async finish(): Promise<void> {
    await firstValueFrom(this.cache.set(ONBOARDING_KEY, true));
    await this.router.navigateByUrl('/location-permission', { replaceUrl: true });
  }
}
