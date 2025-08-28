import { html, LitElement, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { when } from 'lit/directives/when.js';
import packageJson from '../package.json' with { type: 'json' }; 
import { LocalizeController } from './library/localize.js';
import stylesOriginal from './slider.styles.js';
import type FormControl from './library/form-control.js';
import shadowRootMode from './library/shadow-root-mode.js';
import final from './library/final.js';
import required from './library/required.js';
import './label.js';

const optimizedStyles = [
  stylesOriginal,
  css`
    .filled-track {
      left: var(--slider-fill-left, 0);
      width: var(--slider-fill-width, 0);
      will-change: left, width;
    }
    
    .handle {
      /* CSS custom property for position updates */
      left: var(--handle-position, 0);
      will-change: left;
    }
    
    .handle.minimum {
      left: var(--handle-min-position, 0);
    }
    
    .handle.maximum {
      left: var(--handle-max-position, 0);
    }
    
    /* Optimize transitions during drag */
    .dragging .handle {
      transition: none !important;
    }
    
    .dragging .filled-track {
      transition: none !important;
    }
  `
];

declare global {
  interface HTMLElementTagNameMap {
    'glide-core-slider-optimized': SliderOptimized;
  }
}

@customElement('glide-core-slider-optimized')
@final
export default class SliderOptimized extends LitElement implements FormControl {
  static formAssociated = true;

  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    mode: shadowRootMode,
    delegatesFocus: true,
  };

  static override styles = optimizedStyles;

  @property({ reflect: true })
  name = '';

  @property({ reflect: true })
  @required
  label?: string;
  
  @property({ reflect: true })
  summary?: string;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true, attribute: 'hide-label' })
  hideLabel = false;

  @property({ type: Number, reflect: true })
  max = 100;

  @property({ type: Number, reflect: true })
  min = 0;

  @property({ type: Boolean, reflect: true })
  multiple = false;

  @property({ reflect: true })
  orientation: 'horizontal' | 'vertical' = 'horizontal';
  
  @property({ reflect: true })
  privateSplit?: 'left' | 'middle' | 'right';

  @property({ type: Boolean, reflect: true })
  readonly = false;

  @property({ type: Boolean, reflect: true })
  required = false;

  @property({ type: Number, reflect: true })
  step = 1;
  
  @property({ reflect: true })
  tooltip?: string;

  @property({ reflect: true })
  readonly version: string = packageJson.version;

  // Internal state
  @state()
  private minimumValue?: number;

  @state()
  private maximumValue?: number;

  @state()
  private isDragging = false;

  #internals = this.attachInternals();
  #initialValue: number[] = [];
  #localize = new LocalizeController(this);
  #pendingUpdate: number | null = null;
  #sliderElementRef = createRef<HTMLDivElement>();
  #draggingHandleElement: HTMLElement | null = null;
  #minimumHandleElementRef = createRef<HTMLDivElement>();
  #maximumHandleElementRef = createRef<HTMLDivElement>();
  #singleHandleElementRef = createRef<HTMLDivElement>();
  #abortController = new AbortController();
  #positionCache = new WeakMap<HTMLElement, number>();
  #performanceObserver?: PerformanceObserver;

  @property({ type: Array })
  get value(): number[] {
    if (
      this.multiple &&
      this.minimumValue !== undefined &&
      this.maximumValue !== undefined
    ) {
      return [this.minimumValue, this.maximumValue];
    }

    if (this.minimumValue !== undefined) {
      return [this.minimumValue];
    }

    return [];
  }

  set value(value: number[]) {
    // Advanced: Use Proxy for input validation and transformation
    const validatedValue = new Proxy(value, {
      get: (target, prop) => {
        if (prop === 'length') return target.length;
        const index = Number(prop);
        if (!isNaN(index) && target[index] !== undefined) {
          // Ensure values are within bounds
          return Math.max(this.min, Math.min(this.max, target[index]));
        }
        return target[prop as keyof typeof target];
      }
    });

    if (validatedValue.length === 0) {
      const rangeSize = this.max - this.min;
      this.minimumValue = this.min + Math.floor(rangeSize * 0.25);
      this.maximumValue = this.multiple
        ? this.min + Math.ceil(rangeSize * 0.75)
        : undefined;
      this.#scheduleUpdate();
      return;
    }

    if (
      this.multiple &&
      validatedValue.length === 2 &&
      validatedValue[0] !== undefined &&
      validatedValue[1] !== undefined
    ) {
      // Advanced: Use optional chaining and nullish coalescing
      const val0 = validatedValue[0] ?? this.min;
      const val1 = validatedValue[1] ?? this.max;
      
      if (val0 > val1) {
        throw new Error('The first value must be less than the second.');
      }

      const normalizedMinimum = Math.round(val0 / this.step) * this.step;
      const normalizedMaximum = Math.round(val1 / this.step) * this.step;

      this.minimumValue = Math.max(normalizedMinimum, this.min);
      this.maximumValue = Math.min(normalizedMaximum, this.max);

      this.#scheduleUpdate();
      return;
    }

    if (validatedValue.length === 1 && validatedValue[0] !== undefined) {
      const normalizedValue = Math.round(validatedValue[0] / this.step) * this.step;
      this.minimumValue = Math.max(Math.min(normalizedValue, this.max), this.min);
      this.maximumValue = undefined;
      this.#scheduleUpdate();
      return;
    }
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  get validity(): ValidityState {
    return this.#internals.validity;
  }

  #scheduleUpdate() {
    if (this.#pendingUpdate !== null) {
      return;
    }

    this.#pendingUpdate = requestAnimationFrame(() => {
      this.#updateHandlesAndTrackOptimized();
      this.#pendingUpdate = null;
    });
  }

  #updateHandlesAndTrackOptimized() {
    if (!this.#sliderElementRef.value || this.minimumValue === undefined) {
      return;
    }

    const range = this.max - this.min;
    
    if (!this.multiple) {
      const calculatedPosition = ((this.minimumValue - this.min) / range) * 100;
      
      this.style.setProperty('--handle-position', `${calculatedPosition}%`);
      this.style.setProperty('--slider-fill-left', '0');
      this.style.setProperty('--slider-fill-width', `${calculatedPosition}%`);
    } else if (this.maximumValue !== undefined) {
      const minimumPosition = ((this.minimumValue - this.min) / range) * 100;
      const maximumPosition = ((this.maximumValue - this.min) / range) * 100;
      
      // Batch all CSS custom property updates
      this.style.setProperty('--handle-min-position', `${minimumPosition}%`);
      this.style.setProperty('--handle-max-position', `${maximumPosition}%`);
      this.style.setProperty('--slider-fill-left', `${minimumPosition}%`);
      this.style.setProperty('--slider-fill-width', `${maximumPosition - minimumPosition}%`);
    }
  }

  #debounce = <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  #throttleRAF = <T extends (...args: any[]) => any>(fn: T) => {
    let rafId: number | null = null;
    return (...args: Parameters<T>) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        fn.apply(this, args);
        rafId = null;
      });
    };
  };

  #startDragging(event: PointerEvent, handle: HTMLElement) {
    if (this.disabled || this.readonly) {
      return;
    }

    event.preventDefault();
    this.isDragging = true;
    this.#draggingHandleElement = handle;
    
    // Capture pointer for consistent tracking
    handle.setPointerCapture(event.pointerId);
    
    this.#positionCache.set(handle, event.clientX);
    const signal = this.#abortController.signal;
    
    // Use pointer events for unified touch/mouse support
    document.addEventListener('pointermove', this.#onDraggingMove, { signal, passive: false });
    document.addEventListener('pointerup', this.#onDraggingEnd, { signal, once: true });
    document.addEventListener('pointercancel', this.#onDraggingEnd, { signal, once: true });
  }

  #onDraggingMove = this.#throttleRAF((event: PointerEvent) => {
    if (!this.#draggingHandleElement || !this.#sliderElementRef.value) {
      return;
    }

    event.preventDefault();
    this.#updateValueFromPosition(event.clientX);
  });

  #onDraggingEnd = () => {
    this.isDragging = false;
    this.#draggingHandleElement = null;
    
    // Clear position cache
    if (this.#draggingHandleElement) {
      this.#positionCache.delete(this.#draggingHandleElement);
    }
    
    // Modern cleanup: Create new controller for next drag
    this.#abortController = new AbortController();

    // Dispatch change event
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };

  #updateValueFromPosition(clientX: number) {
    if (!this.#sliderElementRef.value) {
      return;
    }

    const rect = this.#sliderElementRef.value.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    const clampedPosition = Math.max(0, Math.min(1, position));
    const range = this.max - this.min;
    const rawValue = this.min + clampedPosition * range;
    const normalizedValue = Math.round(rawValue / this.step) * this.step;

    if (this.multiple) {
      if (this.#draggingHandleElement === this.#minimumHandleElementRef.value) {
        this.minimumValue = Math.min(
          Math.max(normalizedValue, this.min),
          this.maximumValue !== undefined ? this.maximumValue - this.step : this.max
        );
      } else if (this.#draggingHandleElement === this.#maximumHandleElementRef.value) {
        this.maximumValue = Math.max(
          Math.min(normalizedValue, this.max),
          this.minimumValue !== undefined ? this.minimumValue + this.step : this.min
        );
      }
    } else {
      this.minimumValue = Math.max(Math.min(normalizedValue, this.max), this.min);
    }

    this.#scheduleUpdate();
    
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  #onTrackClick(event: PointerEvent) {
    if (this.disabled || this.readonly) {
      return;
    }

    // Don't process clicks on handles
    if ((event.target as HTMLElement).classList.contains('handle')) {
      return;
    }

    this.#updateValueFromPosition(event.clientX);
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  override connectedCallback() {
    super.connectedCallback();
    
    // Initialize with default values
    if (this.value.length === 0) {
      const rangeSize = this.max - this.min;
      this.minimumValue = this.min + Math.floor(rangeSize * 0.25);
      this.maximumValue = this.multiple
        ? this.min + Math.ceil(rangeSize * 0.75)
        : undefined;
      this.#initialValue = this.multiple && this.maximumValue !== undefined
        ? [this.minimumValue, this.maximumValue]
        : [this.minimumValue];
    } else {
      // Advanced: Use structuredClone for deep copying (modern alternative to JSON.parse/stringify)
      this.#initialValue = structuredClone(this.value);
    }
    
    // Advanced: Set up performance monitoring in development
    if (process.env.NODE_ENV !== 'production') {
      this.#setupPerformanceMonitoring();
    }
    
    this.#scheduleUpdate();
  }
  
  #setupPerformanceMonitoring() {
    try {
      this.#performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          // Only warn for updates taking longer than 2 frames (33ms)
          if (entry.duration > 33) {
            console.warn(`[SliderOptimized] Slow update detected: ${entry.duration.toFixed(2)}ms`);
          } else if (process.env.NODE_ENV !== 'production' && entry.duration > 16) {
            console.debug(`[SliderOptimized] Update took more than 1 frame: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });
      
      this.#performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // PerformanceObserver might not be available in all environments
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    
    if (this.#pendingUpdate !== null) {
      cancelAnimationFrame(this.#pendingUpdate);
      this.#pendingUpdate = null;
    }

    this.#abortController.abort();
    this.#performanceObserver?.disconnect();
    this.#positionCache = new WeakMap();
  }

  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }

  setCustomValidity(message: string): void {
    if (message) {
      this.#internals.setValidity({ customError: true }, message);
    } else {
      this.#internals.setValidity({});
    }
  }
  
  setValidity(flags?: ValidityStateFlags, message?: string): void {
    this.#internals.setValidity(flags || {}, message);
  }
  
  resetValidityFeedback(): void {
    this.#internals.setValidity({});
  }
  
  formAssociatedCallback(): void {
    // Handle form association
  }

  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled;
  }

  formResetCallback(): void {
    this.value = this.#initialValue;
  }

  formStateRestoreCallback(state: unknown, mode: 'restore' | 'autocomplete'): void {
    if (Array.isArray(state)) {
      this.value = state;
    }
  }

  override render() {
    return html`
      <glide-core-private-label
        label=${ifDefined(this.label)}
        ?disabled=${this.disabled}
        ?hide=${this.hideLabel}
        ?required=${this.required}
      >
        <div
          class="slider-container ${classMap({ 
            dragging: this.isDragging,
            disabled: this.disabled,
            readonly: this.readonly && !this.disabled
          })}"
          slot="control"
        >
          ${when(
            this.multiple,
            () => html`
              <input
                type="number"
                class="input"
                min=${this.min}
                max=${this.maximumValue ? this.maximumValue - this.step : this.max}
                step=${this.step}
                .value=${this.minimumValue?.toString() ?? ''}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                @input=${(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const value = parseFloat(target.value);
                  if (!isNaN(value)) {
                    this.minimumValue = value;
                    this.#scheduleUpdate();
                    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                  }
                }}
              />
            `,
            () => html`
              <input
                type="number"
                class="input"
                min=${this.min}
                max=${this.max}
                step=${this.step}
                .value=${this.minimumValue?.toString() ?? ''}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                @input=${(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const value = parseFloat(target.value);
                  if (!isNaN(value)) {
                    this.minimumValue = value;
                    this.#scheduleUpdate();
                    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                  }
                }}
                @change=${() => {
                  this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                }}
              />
            `
          )}
          
          <div class="track-container">
            <div 
              class="unfilled-track"
              @pointerdown=${this.#onTrackClick}
              ${ref(this.#sliderElementRef)}
            >
              <div class="filled-track"></div>
              
              ${when(
                !this.multiple,
                () => html`
                  <div
                    class="handle"
                    role="slider"
                    tabindex="0"
                    aria-label=${this.label ?? ''}
                    aria-valuemin=${this.min}
                    aria-valuemax=${this.max}
                    aria-valuenow=${this.minimumValue ?? this.min}
                    @pointerdown=${(e: PointerEvent) => this.#startDragging(e, this.#singleHandleElementRef.value!)}
                    @touchstart=${(e: TouchEvent) => e.preventDefault()}
                    ${ref(this.#singleHandleElementRef)}
                  ></div>
                `,
                () => html`
                  <div
                    class="handle minimum"
                    role="slider"
                    tabindex="0"
                    aria-label="Minimum ${this.label ?? ''}"
                    aria-valuemin=${this.min}
                    aria-valuemax=${this.maximumValue ?? this.max}
                    aria-valuenow=${this.minimumValue ?? this.min}
                    @pointerdown=${(e: PointerEvent) => this.#startDragging(e, this.#minimumHandleElementRef.value!)}
                    @touchstart=${(e: TouchEvent) => e.preventDefault()}
                    ${ref(this.#minimumHandleElementRef)}
                  ></div>
                  <div
                    class="handle maximum"
                    role="slider"
                    tabindex="0"
                    aria-label="Maximum ${this.label ?? ''}"
                    aria-valuemin=${this.minimumValue ?? this.min}
                    aria-valuemax=${this.max}
                    aria-valuenow=${this.maximumValue ?? this.max}
                    @pointerdown=${(e: PointerEvent) => this.#startDragging(e, this.#maximumHandleElementRef.value!)}
                    @touchstart=${(e: TouchEvent) => e.preventDefault()}
                    ${ref(this.#maximumHandleElementRef)}
                  ></div>
                `
              )}
            </div>
          </div>
          
          ${when(
            this.multiple,
            () => html`
              <input
                type="number"
                class="input"
                min=${this.minimumValue ? this.minimumValue + this.step : this.min}
                max=${this.max}
                step=${this.step}
                .value=${this.maximumValue?.toString() ?? ''}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                @input=${(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const value = parseFloat(target.value);
                  if (!isNaN(value)) {
                    this.maximumValue = value;
                    this.#scheduleUpdate();
                    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                  }
                }}
              />
            `
          )}
        </div>
      </glide-core-private-label>
    `;
  }
}