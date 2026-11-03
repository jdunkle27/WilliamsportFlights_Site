import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the aircraft tracker', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Air traffic');
    expect(compiled.querySelector('table')).toBeTruthy();
  });

  it('should render a real interactive map centered on Williamsport with aircraft details', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.aircraft = [{
      hex: 'A1B2C3',
      tailnumber: 'N123AB',
      latitude: 41.2418,
      longitude: -77.0096,
      altitude: 12000,
      velocity: 245,
      rotation: 45
    }];

    app.lastUpdated = new Date();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.map-panel')).toBeTruthy();
    expect(compiled.querySelector('.leaflet-container')).toBeTruthy();
    expect(compiled.querySelectorAll('.aircraft-marker').length).toBe(1);
    expect(compiled.textContent).toContain('N123AB');
    expect(compiled.textContent).toContain('A1B2C3');
  });
});
