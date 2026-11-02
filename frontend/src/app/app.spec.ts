import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';

/** Checks the shared application shell. */
describe('App', () => {
  /** Resets test state and providers. */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  /** Should create the app. */
  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  /** Renders the navigation and routed content outlet. */
  it('renders the navigation and routed content outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header a')?.textContent).toBe('GIG');
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
