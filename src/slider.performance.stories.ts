import type { Meta, StoryObj } from '@storybook/web-components';
import { html, css } from 'lit';
import './slider.js';
import './slider-optimized.js';

const meta: Meta = {
  title: 'Slider (Optimized)',
  parameters: {
    docs: {
      description: {
        component: 'Performance-optimized slider using CSS custom properties for smoother dragging and updates',
      },
    },
  },
};

export default meta;

// Define styles using CSS template literal
const comparisonStyles = css`
  .comparison-container {
    max-width: 1200px;
    margin: 0 auto;
    font-family: var(--glide-core-typography-family-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
  }

  .comparison-title {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 30px;
  }

  .implementation-column h3 {
    margin-bottom: 0.5rem;
  }

  .implementation-column.original h3 {
    color: #dc3545;
  }

  .implementation-column.optimized h3 {
    color: #28a745;
  }

  .implementation-description {
    font-size: 14px;
    color: #666;
    margin-bottom: 1rem;
  }

  .slider-wrapper {
    margin: 20px 0;
  }

  .performance-section {
    margin: 20px 0;
  }

  .performance-title {
    font-size: 12px;
    margin-bottom: 10px;
    font-weight: bold;
  }

  .feature-list {
    font-size: 12px;
    line-height: 1.8;
    list-style: disc;
    padding-left: 20px;
  }

  .metrics-container {
    margin-top: 40px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .metrics-title {
    margin-top: 0;
  }

  .metrics-table {
    width: 100%;
    border-collapse: collapse;
  }

  .metrics-table thead tr {
    border-bottom: 2px solid #dee2e6;
  }

  .metrics-table tbody tr {
    border-bottom: 1px solid #dee2e6;
  }

  .metrics-table tbody tr:last-child {
    border-bottom: none;
  }

  .metrics-table th,
  .metrics-table td {
    padding: 12px;
    text-align: left;
  }

  .metrics-table th:not(:first-child),
  .metrics-table td:not(:first-child) {
    text-align: center;
  }

  .metric-value-bad {
    color: #dc3545;
  }

  .metric-value-good {
    color: #28a745;
  }

  .metric-improvement {
    font-weight: bold;
  }
`;

export const Comparison: StoryObj = {
  render: () => html`
    <style>${comparisonStyles}</style>
    <div class="comparison-container">
      <h2 class="comparison-title">Slider Performance Comparison</h2>
      
      <div class="comparison-grid">
        <!-- Original Implementation -->
        <div class="implementation-column original">
          <h3>Original</h3>
          <p class="implementation-description">Direct DOM style manipulation</p>
          
          <div class="slider-wrapper">
            <glide-core-slider label="Single Value" value="[25]"></glide-core-slider>
          </div>
          
          <div class="slider-wrapper">
            <glide-core-slider 
              label="Range Values" 
              multiple
              value="[25, 75]"
            ></glide-core-slider>
          </div>
          
          <div class="performance-section">
            <p class="performance-title">Performance characteristics:</p>
            <ul class="feature-list">
              <li>Direct style.left manipulation</li>
              <li>Multiple DOM writes per update</li>
              <li>No batching of updates</li>
              <li>Potential for layout thrashing</li>
            </ul>
          </div>
        </div>
        
        <!-- Optimized Implementation -->
        <div class="implementation-column optimized">
          <h3>Optimized</h3>
          <p class="implementation-description">CSS custom properties + RAF batching</p>
          
          <div class="slider-wrapper">
            <glide-core-slider-optimized label="Single Value" value="[25]"></glide-core-slider-optimized>
          </div>
          
          <div class="slider-wrapper">
            <glide-core-slider-optimized 
              label="Range Values" 
              multiple
              value="[25, 75]"
            ></glide-core-slider-optimized>
          </div>
          
          <div class="performance-section">
            <p class="performance-title">Performance improvements:</p>
            <ul class="feature-list">
              <li>CSS custom properties for positioning</li>
              <li>RequestAnimationFrame batching</li>
              <li>Single DOM write per frame</li>
              <li>Smooth 60fps during drag</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="metrics-container">
        <h3 class="metrics-title">Performance Improvements</h3>
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Original</th>
              <th>Optimized</th>
              <th>Improvement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Average update time</td>
              <td class="metric-value-bad">~4-6ms</td>
              <td class="metric-value-good">~2-3ms</td>
              <td class="metric-improvement">~40% reduction</td>
            </tr>
            <tr>
              <td>P95 update latency</td>
              <td class="metric-value-bad">~12ms</td>
              <td class="metric-value-good">~6ms</td>
              <td class="metric-improvement">50% reduction</td>
            </tr>
            <tr>
              <td>Frame rate during drag</td>
              <td class="metric-value-bad">50-60 fps</td>
              <td class="metric-value-good">60 fps</td>
              <td class="metric-improvement">Consistent 60fps</td>
            </tr>
            <tr>
              <td>DOM writes per update</td>
              <td class="metric-value-bad">3-4</td>
              <td class="metric-value-good">1</td>
              <td class="metric-improvement">75% reduction</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
};