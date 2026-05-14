import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SharedModule } from '../../../../shared/shared.module';
import { DetailsComponent } from './details.component';

@Component({
  selector: 'app-salida-details-page',
  standalone: true,
  imports: [CommonModule, SharedModule, DetailsComponent],
  templateUrl: './salida-details-page.component.html',
  styleUrls: ['./salida-details-page.component.scss'],
})
export class SalidaDetailsPageComponent implements OnInit, OnDestroy {
  breadCrumbItems!: Array<{ label?: string; active?: boolean }>;
  saliId = 0;
  private sub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
    const raw = this.route.snapshot.paramMap.get('saliId');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    this.saliId = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'Inventario' },
      { label: 'Salidas', active: false },
      { label: 'Detalle', active: true },
    ];

    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = parseInt(pm.get('saliId') || '', 10);
      this.saliId = Number.isFinite(id) && id > 0 ? id : 0;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  volver(): void {
    void this.router.navigate(['/inventario/salidas/list']);
  }
}
