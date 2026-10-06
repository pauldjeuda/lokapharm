import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CacheService } from './core/services/cache.service';

const ONBOARDING_KEY = 'Lokapharm_onboarding_done_v1';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private readonly cache: CacheService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const onboardingDone = await firstValueFrom(this.cache.get<boolean>(ONBOARDING_KEY));
    if (!onboardingDone) {
      await this.router.navigateByUrl('/onboarding', { replaceUrl: true });
    }
  }
}
