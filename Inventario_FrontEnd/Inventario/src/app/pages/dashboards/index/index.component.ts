import { Component, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface DashKpi {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
  icon: string;
}

export interface DashActivityRow {
  ref: string;
  type: 'Entrada' | 'Salida';
  qty: string;
  time: string;
}

export interface DashChartBar {
  label: string;
  pct: number;
}

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
  providers: [DecimalPipe]
})
export class IndexComponent implements OnInit {
  breadCrumbItems!: Array<{ label: string; active?: boolean }>;

  readonly kpis: DashKpi[] = [
    { label: 'Referencias activas', value: '1.284', delta: '+3,2% vs. ayer', trend: 'up', icon: 'ri-stack-line' },
    { label: 'Unidades en almacén', value: '48.920', delta: '+1,1%', trend: 'up', icon: 'ri-inbox-archive-line' },
    { label: 'Salidas hoy', value: '326', delta: '-0,4%', trend: 'down', icon: 'ri-truck-line' },
    { label: 'Alertas stock bajo', value: '12', delta: '2 nuevas', trend: 'up', icon: 'ri-alarm-warning-line' }
  ];

  readonly activityRows: DashActivityRow[] = [
    { ref: 'SKU-20491', type: 'Entrada', qty: '+240 u.', time: '09:42' },
    { ref: 'SKU-88102', type: 'Salida', qty: '-36 u.', time: '10:18' },
    { ref: 'SKU-44120', type: 'Entrada', qty: '+120 u.', time: '11:05' },
    { ref: 'SKU-20491', type: 'Salida', qty: '-12 u.', time: '11:52' },
    { ref: 'SKU-77301', type: 'Entrada', qty: '+60 u.', time: '12:30' }
  ];

  readonly chartBars: DashChartBar[] = [
    { label: 'Almacén central', pct: 62 },
    { label: 'Tienda A', pct: 24 },
    { label: 'Tienda B', pct: 14 }
  ];

  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'Dashboards', active: true },
      { label: 'Starter', active: true }
    ];
  }
}