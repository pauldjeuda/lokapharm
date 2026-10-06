import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface WikidataEntityResponse {
  entities?: Record<
    string,
    {
      claims?: {
        P18?: Array<{
          mainsnak?: {
            datavalue?: {
              value?: string;
            };
          };
        }>;
      };
    }
  >;
}

@Injectable({ providedIn: 'root' })
export class WikidataApiService {
  constructor(private readonly http: HttpClient) {}

  getImageUrl(wikidataId: string): Observable<string | null> {
    const normalizedId = wikidataId.trim().replace(/^wikidata:/i, '');
    if (!/^Q\d+$/i.test(normalizedId)) {
      return of(null);
    }

    const entityId = normalizedId.toUpperCase();

    return this.http
      .get<WikidataEntityResponse>(
        `https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`
      )
      .pipe(
        map((response) => {
          const filename = response.entities?.[entityId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
          if (!filename) {
            return null;
          }

          return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=900`;
        }),
        catchError(() => of(null))
      );
  }
}
