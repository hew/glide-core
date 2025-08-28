import { html, LitElement, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property, state } from 'lit/decorators.js';
import packageJson from '../package.json' with { type: 'json' };
import chevronIcon from './icons/chevron.js';
import shadowRootMode from './library/shadow-root-mode.js';
import final from './library/final.js';
import required from './library/required.js';

declare global {
  interface HTMLElementTagNameMap {
    'glide-core-accordion-optimized': AccordionOptimized;
  }
}

const accordionStyles = css`
    :host {
      display: block;
      font-family: var(--glide-core-typography-family-primary);
    }

    .accordion {
      border: 1px solid var(--glide-core-color-static-surface-container-secondary);
      border-radius: var(--glide-core-rounding-base-radius-md);
      box-shadow: var(--glide-core-effect-lifted);
      overflow: hidden;
    }

    .header {
      align-items: center;
      background: transparent;
      border: none;
      border-radius: var(--glide-core-rounding-base-radius-md);
      color: var(--glide-core-color-static-text-default);
      cursor: pointer;
      display: flex;
      font-size: var(--glide-core-typography-size-heading-h4);
      font-weight: var(--glide-core-typography-weight-bold);
      justify-content: space-between;
      line-height: var(--glide-core-typography-height-heading-h4);
      padding: var(--glide-core-spacing-base-xs);
      text-align: left;
      user-select: none;
      width: 100%;
    }

    .header:focus-visible {
      outline: 2px solid var(--glide-core-color-interactive-stroke-active);
      outline-offset: -2px;
    }

    .chevron {
      align-items: center;
      display: flex;
      margin-inline-end: var(--glide-core-spacing-base-xxs);
      transform: rotate(-90deg);
      transition: transform var(--glide-core-duration-slow-01) var(--glide-core-animation-swoop);
    }

    .header[aria-expanded="true"] .chevron {
      transform: rotate(0deg);
    }

    .label-container {
      align-items: center;
      display: flex;
      flex: 1;
      gap: var(--glide-core-spacing-base-xs);
      overflow: hidden;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* The magic: CSS Grid animation */
    .content-wrapper {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows var(--glide-core-duration-slow-01) var(--glide-core-animation-swoop);
    }

    .content-wrapper[data-open="true"] {
      grid-template-rows: 1fr;
    }

    .content {
      overflow: hidden;
      min-height: 0;
    }

    .content-inner {
      color: var(--glide-core-color-static-text-default);
      font-size: var(--glide-core-typography-size-body-default);
      font-weight: var(--glide-core-typography-weight-regular);
      padding: 0 var(--glide-core-spacing-base-sm) var(--glide-core-spacing-base-sm);
      padding-inline-start: calc(var(--glide-core-spacing-base-sm) + var(--glide-core-spacing-base-md));
    }

    /* Prefix icon styles */
    .prefix-icon {
      display: none;
    }

    .prefix-icon.has-content {
      align-items: center;
      display: flex;
    }

    .content-inner.indented {
      padding-inline-start: 3.25rem;
    }

    /* Suffix icons styles */
    .suffix-icons {
      align-items: center;
      color: var(--glide-core-color-interactive-icon-link);
      display: none;
      gap: 0.625rem;
      margin-inline-start: var(--glide-core-spacing-base-xs);
    }

    .suffix-icons.has-content {
      display: flex;
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .chevron,
      .content-wrapper {
        transition: none;
      }
    }
`;

/**
 * Performance-optimized accordion using CSS Grid animations
 */
@customElement('glide-core-accordion-optimized')
@final
export default class AccordionOptimized extends LitElement {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
    mode: shadowRootMode,
  };

  static override styles = accordionStyles;

  @property({ reflect: true })
  @required
  label?: string;

  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ reflect: true })
  readonly version: string = packageJson.version;
  
  #performanceObserver?: PerformanceObserver;
  #animationStartTime?: number;
  #abortController = new AbortController();

  @state()
  private hasPrefixIcon = false;

  @state()
  private hasSuffixIcons = false;
  
  override connectedCallback() {
    super.connectedCallback();
    
    // Advanced: Set up performance monitoring in development
    if (process.env.NODE_ENV !== 'production') {
      this.#setupPerformanceMonitoring();
    }
    
    this.#setupResizeObserver();
    this.#setupIntersectionObserver();
  }
  
  override disconnectedCallback() {
    super.disconnectedCallback();
    
    this.#performanceObserver?.disconnect();
    this.#resizeObserver?.disconnect();
    this.#intersectionObserver?.disconnect();
    this.#abortController.abort();
    
    try {
      performance.clearMarks('accordion-animation-start');
      performance.clearMarks('accordion-animation-end');
      performance.clearMeasures('accordion-animation');
    } catch (e) {
      // Performance API might not be available
    }
  }
  
  #resizeObserver?: ResizeObserver;
  #intersectionObserver?: IntersectionObserver;
  #isVisible = true;
  
  #setupResizeObserver() {
    try {
      const contentElement = this.shadowRoot?.querySelector('.content-inner');
      if (contentElement) {
        this.#resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            // Detect significant size changes that might affect performance
            if (entry.contentRect.height > 1000) {
              console.info(`[AccordionOptimized] Large content detected: ${entry.contentRect.height}px`);
            }
          }
        });
        
        this.#resizeObserver.observe(contentElement);
      }
    } catch (e) {
      // ResizeObserver might not be available
    }
  }
  
  #setupIntersectionObserver() {
    try {
      this.#intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            this.#isVisible = entry.isIntersecting;
            
            if (!this.#isVisible && this.open) {
              this.style.setProperty('--glide-core-duration-slow-01', '0ms');
            } else {
              this.style.removeProperty('--glide-core-duration-slow-01');
            }
          });
        },
        { threshold: 0.1 }
      );
      
      this.#intersectionObserver.observe(this);
    } catch (e) {
      // IntersectionObserver might not be available
    }
  }

  override render() {
    return html`
      <div class="accordion">
        <button
          class="header"
          @click=${this.#toggle}
          aria-expanded=${this.open ? 'true' : 'false'}
        >
          <span class="chevron">${chevronIcon}</span>
          
          <div class="label-container">
            <slot
              class=${classMap({
                'prefix-icon': true,
                'has-content': this.hasPrefixIcon,
              })}
              name="prefix-icon"
              @slotchange=${this.#onPrefixIconSlotChange}
            ></slot>
            
            <span class="label">${this.label}</span>
          </div>
          
          <slot
            class=${classMap({
              'suffix-icons': true,
              'has-content': this.hasSuffixIcons,
            })}
            name="suffix-icons"
            @slotchange=${this.#onSuffixIconsSlotChange}
          ></slot>
        </button>
        
        <div 
          class="content-wrapper" 
          data-open=${this.open ? 'true' : 'false'}
          @transitionend=${this.#onTransitionEnd}
        >
          <div class="content">
            <div class=${classMap({
              'content-inner': true,
              'indented': this.hasPrefixIcon,
            })}>
              <slot></slot>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #toggle() {
    if (this.#performanceObserver) {
      this.#animationStartTime = performance.now();
      performance.mark('accordion-animation-start');
    }
    
    this.open = !this.open;
    
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) {
      this.#dispatchToggle();
    }
  }

  #onTransitionEnd(event: TransitionEvent) {
    if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
      // Advanced: Measure animation performance
      if (this.#performanceObserver && this.#animationStartTime) {
        performance.mark('accordion-animation-end');
        performance.measure(
          'accordion-animation',
          'accordion-animation-start',
          'accordion-animation-end'
        );
        
        const duration = performance.now() - this.#animationStartTime;
        // Only warn if animation is significantly slower than expected (50% over design duration)
        if (duration > 600) { // Design system uses 400ms, warn at 600ms
          console.warn(`[AccordionOptimized] Slow animation detected: ${duration.toFixed(2)}ms`);
        } else if (process.env.NODE_ENV !== 'production') {
          // In dev, log successful animations for monitoring
          console.debug(`[AccordionOptimized] Animation completed: ${duration.toFixed(2)}ms`);
        }
        
        this.#animationStartTime = undefined;
      }
      
      this.#dispatchToggle();
    }
  }

  #dispatchToggle() {
    this.dispatchEvent(new Event('toggle', { bubbles: true, composed: true }));
  }
  
  #setupPerformanceMonitoring() {
    try {
      this.#performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'accordion-animation' && entry.duration > 600) {
            console.warn(`[AccordionOptimized] Animation performance issue: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });
      
      this.#performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // PerformanceObserver might not be available in all environments
    }
  }

  #onPrefixIconSlotChange(event: Event) {
    const slot = event.target as HTMLSlotElement;
    this.hasPrefixIcon = slot.assignedNodes().length > 0;
  }

  #onSuffixIconsSlotChange(event: Event) {
    const slot = event.target as HTMLSlotElement;
    this.hasSuffixIcons = slot.assignedNodes().length > 0;
  }
}